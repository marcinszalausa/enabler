import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeVideoAds, type BrandBrief, type VideoAd } from "@/lib/ai/claude";
import {
  generateMusic,
  generateVoiceover,
  getAdVideo,
  submitAdVideo,
} from "@/lib/ai/fal";
import { QualityError, generateCheckedImage } from "@/lib/pipeline";
import { getBrandKit } from "@/lib/brand-kit";
import { FONTS, loadFont, textColorOn } from "@/lib/brand";
import { editVideoAd } from "@/lib/video-edit";
import { userMessage } from "@/lib/errors";
import { autopilotRun } from "@/lib/social/publish";
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

type Job = { generationId: string; workspaceId: string; productId: string };

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
}: Job & { options: VideoOptions }) {
  const db = createAdminClient();
  await db
    .from("generations")
    .update({ status: "running" })
    .eq("id", generationId);

  try {
    const { data: product, error } = await db
      .from("products")
      .select("brand_brief, image_urls")
      .eq("id", productId)
      .single();
    if (error || !product?.brand_brief) throw new Error("Product not found.");

    const brief = product.brand_brief as BrandBrief;
    const referenceImageUrl = (product.image_urls as string[])[0] ?? null;
    const shotSeconds = LENGTHS[options.length];
    const ads = await writeVideoAds(
      brief,
      VIDEOS_PER_GENERATION,
      shotSeconds,
      options,
    );

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
            filmShots(ad, shotSeconds, referenceImageUrl, brief.product_name),
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
): Promise<string[]> {
  const check = (prompt: string, reference: string | null, sameScene = false) =>
    generateCheckedImage({
      prompt,
      aspect: "9:16",
      referenceImageUrl: reference,
      sameScene,
      product,
    });
  const first = await check(ad.shots[0].image_prompt, referenceImageUrl);
  let rest: string[];
  try {
    rest = await Promise.all(
      ad.shots.slice(1).map((s) => check(s.image_prompt, first, true)),
    );
  } catch (err) {
    if (!(err instanceof QualityError)) throw err;
    // A later shot kept failing the check; start every shot from the first
    // frame rather than drop the ad. The shot count stays, so the edit
    // still knows the ad's length.
    console.warn("later shot rejected, filming from the first", err.message);
    rest = ad.shots.slice(1).map(() => first);
  }
  return Promise.all(
    [first, ...rest].map((frame, i) =>
      submitAdVideo({
        startImageUrl: frame,
        prompt: ad.shots[i].motion_prompt,
        seconds: shotSeconds[i],
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
    .select("id, workspace_id, status, created_at")
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
          job,
          clipUrls as string[],
        );
        job.status = "done";
      } catch (err) {
        console.error("video job failed", job.id, err);
        await failJob(job, userMessage(err, "The video couldn't be made."));
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
  const { data: closed } = await db
    .from("generations")
    .update({ status: done > 0 ? "succeeded" : "failed", error })
    .eq("id", generationId)
    .eq("status", "running")
    .select("cost_credits");
  const cost = closed?.[0]?.cost_credits;
  if (cost === undefined) return;
  // Every video in a run has the same length, so the same price.
  const refund = cost - done * (cost / VIDEOS_PER_GENERATION);
  if (refund > 0) {
    await db.rpc("refund_credits", { ws: workspaceId, amount: refund });
  }
  if (done > 0) await autopilotRun(workspaceId, generationId);
}

async function saveVideo(
  workspaceId: string,
  generationId: string,
  job: VideoJob,
  clipUrls: string[],
) {
  const db = createAdminClient();
  const kit = await getBrandKit(db, workspaceId);
  const [clips, voice, music, logo, font] = await Promise.all([
    Promise.all(clipUrls.map(download)),
    downloadStored(job.voice_path!),
    downloadStored(job.music_path!),
    kit.logo_path
      ? db.storage.from("creatives").createSignedUrl(kit.logo_path, 300)
      : Promise.resolve(null),
    loadFont(kit.font),
  ]);

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

  const insert = await db.from("creatives").insert({
    workspace_id: workspaceId,
    generation_id: generationId,
    kind: "video",
    aspect: "9:16",
    storage_path: path,
    angle: job.angle,
    headline: job.headline,
    primary_text: job.primary_text,
    cta: job.cta,
  });
  if (insert.error) throw insert.error;
  await updateJob(job.id, { status: "done", error: null });
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Couldn't download ${new URL(url).pathname}.`);
  return Buffer.from(await res.arrayBuffer());
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
  const { data } = await createAdminClient()
    .from("video_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", job.status)
    .eq("updated_at", job.updated_at)
    .select("id");
  return (data?.length ?? 0) > 0;
}

async function failJob(job: VideoJob, error: string) {
  await updateJob(job.id, { status: "failed", error });
  job.status = "failed";
  job.error = error;
}

async function updateJob(id: string, fields: Partial<VideoJob>) {
  await createAdminClient()
    .from("video_jobs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
}

function age(timestamp: string) {
  return Date.now() - Date.parse(timestamp);
}
