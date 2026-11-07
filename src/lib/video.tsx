import "server-only";
import {revisionFromOptions} from "@/lib/creative-revision";
import { generationDirection } from "@/lib/generation-direction";
import {sampleVideoShots} from "@/lib/media-quality";
import {requireReview} from "@/lib/media-quality-policy";
import { withCreativePreferences, type CreativePreferences } from "@/lib/creative-preferences";
import { transitionVideoJob } from "@/lib/video-job-state";
import { fetchPublicUrl } from "@/lib/public-fetch";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimGeneration, finalizeGeneration } from "@/lib/generation-credits";
import { reviewAdVideo, writeVideoAds, type BrandBrief, type VideoAd } from "@/lib/ai/claude";
import {
  generateMusic,
  generateVoiceover,
  getAdVideo,
  submitAdVideo,
} from "@/lib/ai/fal";
import { QualityError, generateCheckedImage } from "@/lib/pipeline";
import {approvedCatalogModel,type CatalogModel} from "@/lib/catalog/model-inference";
import type { Quality } from "@/lib/quality";
import { getBrandKit } from "@/lib/brand-kit";
import { DEFAULT_BRAND_KIT, FONTS, loadFont, textColorOn } from "@/lib/brand";
import { brandDnaOff } from "@/lib/create-options";
import { editVideoAd } from "@/lib/video-edit";
import { userMessage } from "@/lib/errors";
import { autopilotRun } from "@/lib/social/publish";
import { runSourceImage, sourceImageUrl } from "@/lib/source-image";
import {
  DEFAULT_VIDEO_OPTIONS,
  LENGTHS,
  VIDEOS_PER_GENERATION,
  shotSecondsFor,
  voiceFor,
  type VideoOptions,
} from "@/lib/video-options";

export { VIDEOS_PER_GENERATION };
// The default length, used where a run's own length isn't known.
export const VIDEO_SECONDS = Number(DEFAULT_VIDEO_OPTIONS.length);

// Past these ages a job's worker is presumed dead and the job is failed
// (or, while processing, picked up again by the next check).
const DRAFTING_TIMEOUT_MS = 10 * 60_000;
const PENDING_TIMEOUT_MS = 30 * 60_000;
const PROCESSING_TIMEOUT_MS = 5 * 60_000;

type Job = { generationId: string; workspaceId: string; productId: string; creativePreferences?: CreativePreferences | null };

type VideoJob = {
  id: string;
  status: "drafting" | "pending" | "processing" | "done" | "failed";
  request_ids: string[];
  voiceover: string | null;
  voice_path: string | null;
  music_path: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  angle: string | null;
  error: string | null;
  updated_at: string;
};

// First half of a video run: scripts, then for each ad its checked shots
// (each handed to the video model), voiceover and music. The clips are
// collected later by advanceVideoGeneration, since they take longer than
// this request may run.
export async function runVideoGeneration({
  generationId,
  workspaceId,
  productId,
  options,
  creativePreferences,
}: Job & { options: VideoOptions }) {
  const db = createAdminClient();
  if (!(await claimGeneration(db, generationId))) return;

  try {
    const { data: product, error } = await db
      .from("products")
      .select("brand_brief, image_urls")
      .eq("id", productId)
      .single();
    if (error || !product?.brand_brief) throw new Error("Product not found.");

    const direction = await generationDirection(db, generationId, workspaceId);
    if(direction.revision&&direction.revision.kind!=="video")throw new Error("Revision media type mismatch.");
    const brief = { ...withCreativePreferences(product.brand_brief as BrandBrief, creativePreferences), ...direction };
    if (direction.brand_memory?.tone) brief.tone = direction.brand_memory.tone;
    if (!brief.creative_preferences && direction.brand_memory?.audience) brief.audience = direction.brand_memory.audience;
    // The photo the owner picked for this run, else the product's first.
    const referenceImageUrl = await sourceImageUrl(db, workspaceId,
      await runSourceImage(db, generationId, workspaceId), (product.image_urls as string[])[0] ?? null);
    const shotSeconds = LENGTHS[options.length];
    const catalogModel=direction.revision?null:await approvedCatalogModel(workspaceId,productId);
    const written = await writeVideoAds(
      brief,
      direction.revision?1:VIDEOS_PER_GENERATION,
      shotSeconds,
      options,
    );

    const ads=direction.revision?written.slice(0,1):written;
    if(direction.revision&&ads.length!==1)throw new Error("No revision script was created.");

    const { data: jobs, error: insertError } = await db
      .from("video_jobs")
      .insert(
        ads.map((ad) => ({
          workspace_id: workspaceId,
          generation_id: generationId,
          angle: ad.angle,
          headline: ad.headline,
          primary_text: ad.primary_text,
          cta: ad.cta,
          voiceover: ad.voiceover,
        })),
      )
      .select("id");
    if (insertError || !jobs) throw insertError ?? new Error("No jobs.");

    await db
      .from("generations")
      .update({
        prompt: [
          `Options: ${JSON.stringify(options)}`,
          ...ads.map((a) =>
            [
              ...a.shots.map(
                (s, i) =>
                  `Shot ${i + 1}: ${s.image_prompt}\nMotion: ${s.motion_prompt}`,
              ),
              `Voiceover: ${a.voiceover}`,
              `Music: ${a.music_prompt}`,
            ].join("\n"),
          ),
        ].join("\n\n"),
      })
      .eq("id", generationId);

    await Promise.all(
      ads.map(async (ad, i) => {
        const jobId = jobs[i].id;
        try {
          const [requestIds, sound] = await Promise.all([
            filmShots(ad, shotSeconds, referenceImageUrl, brief.product_name, options.quality,catalogModel),
            recordSound(
              options,
              ad,
              shotSeconds,
              `${workspaceId}/${generationId}/video-${jobId.slice(0, 8)}`,
            ),
          ]);
          await updateJob(jobId, {
            status: "pending",
            request_ids: requestIds,
            ...sound,
          });
        } catch (err) {
          console.error("video draft failed", generationId, err);
          await updateJob(jobId, {
            status: "failed",
            error:
              err instanceof QualityError
                ? `The quality check rejected a shot three times: ${err.message}`
                : userMessage(err, "Couldn't set up the shots."),
          });
        }
      }),
    );
  } catch (err) {
    console.error("video generation failed", generationId, err);
    await finishGeneration(
      generationId,
      workspaceId,
      userMessage(err, "Generation failed. Please try again."),
    );
    return;
  }
  await advanceVideoGeneration(generationId);
}

// Makes each shot's first frame (later shots from the first, so the person
// and setting carry over), checks it, and sends it to the video model.
// Returns the video model's request ids, in shot order.
async function filmShots(
  ad: VideoAd,
  shotSeconds: readonly number[],
  referenceImageUrl: string | null,
  product: string,
  quality: Quality,
  catalogModel?:CatalogModel|null,
): Promise<string[]> {
  const check = (prompt: string, reference: string | null, sameScene = false) =>
    generateCheckedImage({
      catalogModel:sameScene?null:catalogModel,
      prompt,
      aspect: "9:16",
      quality,
      referenceImageUrl: reference,
      productReferenceImageUrl:referenceImageUrl,
      sameScene,
      product,
    });
  const first = await check(ad.shots[0].image_prompt, referenceImageUrl);
  const rest=await Promise.all(ad.shots.slice(1).map(s=>check(s.image_prompt,first,true)));
  return Promise.all(
    [first, ...rest].map((frame, i) =>
      submitAdVideo({
        startImageUrl: frame,
        prompt: ad.shots[i].motion_prompt,
        seconds: shotSeconds[i],
        quality,
      }),
    ),
  );
}

// Voiceover and music, kept in storage until the shots are ready.
async function recordSound(
  options: VideoOptions,
  ad: VideoAd,
  shotSeconds: readonly number[],
  base: string,
) {
  const seconds = shotSeconds.reduce((a, b) => a + b, 0);
  const voice = voiceFor(options);
  const [voiceUrl, musicUrl] = await Promise.all([
    generateVoiceover({
      text: ad.voiceover,
      voice: voice.name,
      tag: voice.tag,
      languageCode: voice.languageCode,
    }),
    generateMusic({ prompt: ad.music_prompt, seconds: seconds + 1 }),
  ]);
  const [voice_path, music_path] = await Promise.all(
    [
      [voiceUrl, `${base}-voice.mp3`, "audio/mpeg"],
      [musicUrl, `${base}-music.wav`, "audio/wav"],
    ].map(async ([url, path, contentType]) => {
      const bytes = await download(url);
      const { error } = await createAdminClient()
        .storage.from("creatives")
        .upload(path, bytes, { contentType, upsert: true });
      if (error) throw error;
      return path;
    }),
  );
  return { voice_path, music_path };
}

// Collects finished clips: adds the headline, call to action and logo,
// saves each as a creative, and closes the run once no clip is outstanding.
// Safe to call repeatedly and concurrently; the product page calls it while
// a video run is open.
export async function advanceVideoGeneration(generationId: string) {
  const db = createAdminClient();
  const { data: generation } = await db
    .from("generations")
    .select("id, workspace_id, status, created_at, product_id")
    .eq("id", generationId)
    .eq("type", "video_ads")
    .maybeSingle();
  if (!generation || generation.status !== "running") return;

  const { data: jobs } = await db
    .from("video_jobs")
    .select(
      "id, status, request_ids, voiceover, voice_path, music_path, headline, primary_text, cta, angle, error, updated_at",
    )
    .eq("generation_id", generationId)
    .returns<VideoJob[]>();

  // The first half died before any job was written.
  if (!jobs?.length) {
    if (age(generation.created_at) > DRAFTING_TIMEOUT_MS) {
      await finishGeneration(
        generationId,
        generation.workspace_id,
        "This run stopped before it could start. Please try again.",
      );
    }
    return;
  }

  await Promise.all(
    jobs.map(async (job) => {
      try {
        if (job.status === "drafting") {
          if (age(job.updated_at) > DRAFTING_TIMEOUT_MS) {
            await failJob(job, "The opening frame took too long.");
          }
          return;
        }
        const reclaim =
          job.status === "processing" &&
          age(job.updated_at) > PROCESSING_TIMEOUT_MS;
        if (job.status !== "pending" && !reclaim) return;

        const clipUrls = await Promise.all(job.request_ids.map(getAdVideo));
        if (clipUrls.some((url) => !url)) {
          if (age(job.updated_at) > PENDING_TIMEOUT_MS) {
            await failJob(job, "The video model took too long.");
          }
          return;
        }
        if (!(await claimJob(job))) return;
        await saveVideo(
          generation.workspace_id,
          generationId,
          generation.product_id,
          job,
          clipUrls as string[],
        );
      } catch (err) {
        console.error("video job failed", job.id, err);
        await failJob(job, err instanceof QualityError ? "The video did not pass quality review: "+err.message : userMessage(err, "The video couldn't be made."));
      }
    }),
  );

  const open = jobs.some((j) =>
    ["drafting", "pending", "processing"].includes(j.status),
  );
  if (!open) {
    const done = jobs.filter((j) => j.status === "done").length;
    const failed = jobs.length - done;
    const reason = jobs.find((j) => j.status === "failed")?.error;
    await finishGeneration(
      generationId,
      generation.workspace_id,
      done === 0
        ? (reason ?? "No videos were made.")
        : failed > 0
          ? `${failed} video(s) were dropped and refunded.${reason ? ` ${reason}` : ""}`
          : null,
      done,
    );
  }
}

// Marks the run finished and refunds every video it didn't deliver. Only
// the first caller to close a running run refunds.
async function finishGeneration(
  generationId: string,
  workspaceId: string,
  error: string | null,
  done = 0,
) {
  const db = createAdminClient();
  const { data: generation, error: readError } = await db
    .from("generations").select("cost_credits,request_options")
    .eq("id", generationId).eq("workspace_id", workspaceId).single();
  if (readError || !generation) throw readError ?? new Error("Generation not found.");
  const { count, error: countError } = await db.from("creatives")
    .select("id", { count: "exact", head: true })
    .eq("generation_id", generationId).eq("workspace_id", workspaceId).eq("kind", "video");
  if (countError || count === null) throw countError ?? new Error("Missing video output count.");
  // A creative insert may commit even when its response is lost.
  done = count;
  const revision=revisionFromOptions(generation.request_options);
  const expected=revision?1:VIDEOS_PER_GENERATION;
  if (done === expected) error = null;
  else if (done > 0) error = "Some videos could not be completed. Undelivered videos were refunded.";
  const cost = generation.cost_credits as number;
  const refund = cost - done * (cost / expected);
  const closed = await finalizeGeneration(
    db, generationId, done > 0 ? "succeeded" : "failed", refund, error,
  );
  if (closed && done > 0 && !revision) await autopilotRun(workspaceId, generationId);
}

async function saveVideo(
  workspaceId: string,
  generationId: string,
  productId:string,
  job: VideoJob,
  clipUrls: string[],
) {
  const db = createAdminClient();
  const { data: run } = await db.from("generations").select("request_options").eq("id", generationId).eq("workspace_id", workspaceId).maybeSingle();
  // Brand DNA off: the video's end card uses Gooidy's neutral look.
  const kit = brandDnaOff(run) ? DEFAULT_BRAND_KIT : await getBrandKit(db, workspaceId);
  const [clips, voice, music, logo, font] = await Promise.all([
    Promise.all(clipUrls.map(download)),
    downloadStored(job.voice_path!),
    downloadStored(job.music_path!),
    kit.logo_path
      ? db.storage.from("creatives").createSignedUrl(kit.logo_path, 300)
      : Promise.resolve(null),
    loadFont(kit.font),
  ]);

  const {data:product,error:productError}=await db.from("products").select("name,brand_brief,image_urls")
   .eq("id",productId).eq("workspace_id",workspaceId).abortSignal(AbortSignal.timeout(5000)).single();
  if(productError||!product)throw productError??new Error("Original product is unavailable.");
  const frames=await sampleVideoShots(clips,shotSecondsFor(clipUrls.length));
  // Compare against the photo the run started from.
  const sourceUrl=await sourceImageUrl(db,workspaceId,await runSourceImage(db,generationId,workspaceId),(product.image_urls as string[]|null)?.[0]??null);
  const verdict=await requireReview(()=>reviewAdVideo({
   frames,referenceImageUrl:sourceUrl,
   product:(product.brand_brief as BrandBrief|null)?.product_name??product.name??"Product"
  }));
  // Small flaws still ship: the clips are already filmed and paid for.
  if(!verdict.ok&&!verdict.minor)throw new QualityError(verdict.issues||"The finished video did not pass visual review.");
  const video = await editVideoAd({
    clips,
    shotSeconds: [...shotSecondsFor(clipUrls.length)],
    voice,
    music,
    voiceover: job.voiceover ?? "",
    headline: job.headline ?? "",
    cta: job.cta ?? "Shop now",
    fontName: FONTS[kit.font].name,
    font,
    accentColor: kit.accent_color,
    accentTextColor: textColorOn(kit.accent_color),
    logoUrl: logo?.data?.signedUrl ?? null,
  });

  const path = `${workspaceId}/${generationId}/video-${job.id.slice(0, 8)}.mp4`;
  const upload = await db.storage
    .from("creatives")
    .upload(path, video, { contentType: "video/mp4", upsert: true });
  if (upload.error) throw upload.error;

  const insert = await db.from("creatives").upsert({
    // One creative per job, even if a processing worker is reclaimed.
    id: job.id,
    workspace_id: workspaceId,
    generation_id: generationId,
    kind: "video",
    aspect: "9:16",
    storage_path: path,
    angle: job.angle,
    headline: job.headline,
    primary_text: job.primary_text,
    cta: job.cta,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (insert.error) throw insert.error;
  await transitionVideoJob(db, job, { status: "done", error: null });
}

async function download(url: string): Promise<Buffer> {
  const response = await fetchPublicUrl(url, { maxBytes: 64*1024*1024, timeoutMs: 60000 });
  if (response.status < 200 || response.status >= 300) throw new Error("Couldn't download generated media.");
  return response.body;
}

async function downloadStored(path: string): Promise<Buffer> {
  const { data, error } = await createAdminClient()
    .storage.from("creatives")
    .download(path);
  if (error || !data) throw error ?? new Error("Missing sound file.");
  return Buffer.from(await data.arrayBuffer());
}

// Moves a job from pending (or a stale processing) to processing; false if
// another check got there first.
async function claimJob(job: VideoJob): Promise<boolean> {
  return transitionVideoJob(createAdminClient(), job, { status: "processing" });
}

async function failJob(job: VideoJob, error: string) {
  await transitionVideoJob(createAdminClient(), job, { status: "failed", error });
}

async function updateJob(id: string, fields: Partial<VideoJob>) {
  const { error } = await createAdminClient()
    .from("video_jobs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

function age(timestamp: string) {
  return Date.now() - Date.parse(timestamp);
}
