import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeVideoAds, type BrandBrief } from "@/lib/ai/claude";
import { getAdVideo, submitAdVideo } from "@/lib/ai/fal";
import { generateCheckedImage, settleWithLimit } from "@/lib/pipeline";
import { getBrandKit } from "@/lib/brand-kit";
import { FONTS, loadFont, textColorOn } from "@/lib/brand";
import { AD_SIZES, AdLayout } from "@/lib/ad-layout";
import { userMessage } from "@/lib/errors";

export const VIDEOS_PER_GENERATION = 3;
export const CREDITS_PER_VIDEO = 15;
export const VIDEO_GENERATION_COST = VIDEOS_PER_GENERATION * CREDITS_PER_VIDEO;

const IMAGE_CONCURRENCY = 3;
// Past these ages a job's worker is presumed dead and the job is failed
// (or, while processing, picked up again by the next check).
const DRAFTING_TIMEOUT_MS = 10 * 60_000;
const PENDING_TIMEOUT_MS = 30 * 60_000;
const PROCESSING_TIMEOUT_MS = 5 * 60_000;

type Job = { generationId: string; workspaceId: string; productId: string };

type VideoJob = {
  id: string;
  status: "drafting" | "pending" | "processing" | "done" | "failed";
  request_id: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  angle: string | null;
  error: string | null;
  updated_at: string;
};

const execFileAsync = promisify(execFile);

// First half of a video run: scripts, then a checked opening frame per ad,
// each handed to the video model. The clips are collected later by
// advanceVideoGeneration, since they take longer than this request may run.
export async function runVideoGeneration({
  generationId,
  workspaceId,
  productId,
}: Job) {
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
    const ads = await writeVideoAds(brief, VIDEOS_PER_GENERATION);

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
        })),
      )
      .select("id");
    if (insertError || !jobs) throw insertError ?? new Error("No jobs.");

    await db
      .from("generations")
      .update({
        prompt: ads
          .map((a) => `${a.image_prompt}\nMotion: ${a.motion_prompt}`)
          .join("\n\n"),
      })
      .eq("id", generationId);

    await settleWithLimit(
      ads.map((ad, i) => async () => {
        const jobId = jobs[i].id;
        try {
          const frameUrl = await generateCheckedImage({
            prompt: ad.image_prompt,
            aspect: "9:16",
            referenceImageUrl,
            product: brief.product_name,
          });
          const requestId = await submitAdVideo({
            startImageUrl: frameUrl,
            prompt: ad.motion_prompt,
          });
          await updateJob(jobId, { status: "pending", request_id: requestId });
        } catch (err) {
          console.error("video frame failed", generationId, err);
          await updateJob(jobId, {
            status: "failed",
            error: userMessage(err, "Couldn't make the opening frame."),
          });
        }
      }),
      IMAGE_CONCURRENCY,
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
      "id, status, request_id, headline, primary_text, cta, angle, error, updated_at",
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

        const videoUrl = await getAdVideo(job.request_id!);
        if (!videoUrl) {
          if (age(job.updated_at) > PENDING_TIMEOUT_MS) {
            await failJob(job, "The video model took too long.");
          }
          return;
        }
        if (!(await claimJob(job))) return;
        await saveVideo(generation.workspace_id, generationId, job, videoUrl);
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
  const refund = cost - done * CREDITS_PER_VIDEO;
  if (refund > 0) {
    await db.rpc("refund_credits", { ws: workspaceId, amount: refund });
  }
}

async function saveVideo(
  workspaceId: string,
  generationId: string,
  job: VideoJob,
  videoUrl: string,
) {
  const db = createAdminClient();
  const res = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error("Couldn't download generated video.");
  const clip = Buffer.from(await res.arrayBuffer());

  const overlay = await renderOverlay(workspaceId, job);
  const video = await burnIn(clip, overlay);

  const base = `${workspaceId}/${generationId}/video-${job.id.slice(0, 8)}`;
  const [raw, final] = await Promise.all([
    // The clip without text, kept so ads can be re-branded later.
    db.storage.from("creatives").upload(`${base}-clip.mp4`, clip, {
      contentType: "video/mp4",
      upsert: true,
    }),
    db.storage.from("creatives").upload(`${base}.mp4`, video, {
      contentType: "video/mp4",
      upsert: true,
    }),
  ]);
  if (raw.error) console.error("raw clip upload failed", raw.error);
  if (final.error) throw final.error;

  const insert = await db.from("creatives").insert({
    workspace_id: workspaceId,
    generation_id: generationId,
    kind: "video",
    aspect: "9:16",
    storage_path: `${base}.mp4`,
    angle: job.angle,
    headline: job.headline,
    primary_text: job.primary_text,
    cta: job.cta,
  });
  if (insert.error) throw insert.error;
  await updateJob(job.id, { status: "done", error: null });
}

// The headline, call to action and logo as a transparent 1080x1920 PNG,
// drawn with the same layout and brand kit as the image ads.
async function renderOverlay(workspaceId: string, job: VideoJob) {
  const db = createAdminClient();
  const kit = await getBrandKit(db, workspaceId);
  const [logo, font] = await Promise.all([
    kit.logo_path
      ? db.storage.from("creatives").createSignedUrl(kit.logo_path, 300)
      : Promise.resolve(null),
    loadFont(kit.font),
  ]);
  const image = new ImageResponse(
    <AdLayout
      photoUrl={null}
      aspect="9:16"
      headline={job.headline ?? ""}
      cta={job.cta ?? "Shop now"}
      fontFamily={FONTS[kit.font].name}
      accentColor={kit.accent_color}
      accentTextColor={textColorOn(kit.accent_color)}
      logoUrl={logo?.data?.signedUrl ?? null}
    />,
    {
      ...AD_SIZES["9:16"],
      fonts: [
        {
          name: FONTS[kit.font].name,
          data: font,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
  return Buffer.from(await image.arrayBuffer());
}

// Lays the overlay over the clip (fading in just after the first frame, so
// the opening shot hooks on its own) and encodes an MP4 that Meta and
// TikTok accept: H.264, AAC, 1080x1920, fast start.
async function burnIn(clip: Buffer, overlay: Buffer): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg is not available here.");
  // Scratch files live in the OS temp folder; tell the bundler not to trace
  // these paths into the deployment.
  const dir = await mkdtemp(
    join(/*turbopackIgnore: true*/ tmpdir(), "gooidy-video-"),
  );
  try {
    const [input, layer, output] = ["in.mp4", "overlay.png", "out.mp4"].map(
      (f) => join(/*turbopackIgnore: true*/ dir, f),
    );
    await Promise.all([
      writeFile(/*turbopackIgnore: true*/ input, clip),
      writeFile(/*turbopackIgnore: true*/ layer, overlay),
    ]);
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-i",
        input,
        "-loop",
        "1",
        "-i",
        layer,
        "-filter_complex",
        [
          "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v]",
          "[1:v]format=rgba,fade=t=in:st=0.4:d=0.5:alpha=1[o]",
          "[v][o]overlay=0:0:shortest=1,format=yuv420p[out]",
        ].join(";"),
        "-map",
        "[out]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        output,
      ],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
    );
    return await readFile(/*turbopackIgnore: true*/ output);
  } finally {
    await rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: true });
  }
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
