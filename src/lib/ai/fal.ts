import "server-only";
import { ApiError, fal } from "@fal-ai/client";
import { UserError } from "@/lib/errors";

export type Aspect = "1:1" | "9:16";

type FalImageOutput = { images: { url: string }[] };

// Product photo available: edit it into a new scene so the real product shows.
// Otherwise: generate the scene from text alone.
export async function generateAdImage(opts: {
  prompt: string;
  // Defects a reviewer found in an earlier try, to steer away from.
  avoid?: string;
  // Use the slower, more precise model (for retries).
  best?: boolean;
  aspect: Aspect;
  referenceImageUrl: string | null;
}): Promise<string> {
  const prompt = `${opts.prompt}. Professional advertising photograph, clean composition, leave calm empty space near the top for a headline. Anatomically correct hands with five fingers each, relaxed and natural. No text, letters, logos or watermarks.${opts.avoid ? ` Avoid these problems: ${opts.avoid}.` : ""}`;

  const result = await callFal(() =>
    opts.referenceImageUrl
      ? fal.subscribe(
          opts.best ? "fal-ai/flux-pro/kontext/max" : "fal-ai/flux-pro/kontext",
          {
            input: {
              prompt: `Place this exact product in a new scene, keeping its color, fabric and design unchanged. Show it only once; nobody else in the scene wears or holds a similar item in another color: ${prompt}`,
              image_url: opts.referenceImageUrl,
              aspect_ratio: opts.aspect,
              output_format: "jpeg",
            },
          },
        )
      : fal.subscribe("fal-ai/flux/dev", {
          input: {
            prompt,
            image_size: opts.aspect === "1:1" ? "square_hd" : "portrait_16_9",
          },
        }),
  );

  const url = (result.data as FalImageOutput).images?.[0]?.url;
  if (!url) throw new Error("Image generation returned no image.");
  return url;
}

export const VIDEO_MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";

// Video clips take minutes, longer than a request should wait, so they go
// through fal's queue: submit now, collect the result on a later check.
export async function submitAdVideo(opts: {
  startImageUrl: string;
  prompt: string;
}): Promise<string> {
  const { request_id } = await callFal(() =>
    fal.queue.submit(VIDEO_MODEL, {
      input: {
        prompt: `${opts.prompt} Vertical social video ad, photorealistic, steady and smooth. The product keeps exactly the color, fabric and design of the first frame. Natural hands and faces. Audio: soft, upbeat background music and gentle ambient sound only; no voices, speech or singing.`,
        start_image_url: opts.startImageUrl,
        duration: "5",
        negative_prompt:
          "blur, distortion, warped hands, extra fingers, morphing product, color change, text, subtitles, watermark, low quality",
        generate_audio: true,
      },
    }),
  );
  return request_id;
}

// The finished clip's URL, null while the model is still working.
// Throws if the model failed on it.
export async function getAdVideo(requestId: string): Promise<string | null> {
  const status = await callFal(() =>
    fal.queue.status(VIDEO_MODEL, { requestId }),
  );
  if (status.status !== "COMPLETED") return null;
  const result = await callFal(() =>
    fal.queue.result(VIDEO_MODEL, { requestId }),
  );
  const url = (result.data as { video?: { url?: string } }).video?.url;
  if (!url) throw new Error("Video generation returned no video.");
  return url;
}

// Turns fal failures into messages that point at the likely fix.
// The full error still goes to the server log.
async function callFal<T>(request: () => Promise<T>, attempt = 1): Promise<T> {
  try {
    return await request();
  } catch (err) {
    // Busy or rate-limited: wait and retry a couple of times.
    if (
      err instanceof ApiError &&
      (err.status === 429 || err.status >= 500) &&
      attempt < 3
    ) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return callFal(request, attempt + 1);
    }
    if (err instanceof ApiError) {
      console.error(
        "fal API error",
        err.status,
        err.message,
        JSON.stringify(err.body),
      );
      if (err.status === 401 || err.status === 403) {
        throw new UserError(
          "The image service rejected our API key or has no balance. Check FAL_KEY and fal billing.",
        );
      }
      if (err.status === 422) {
        throw new UserError(
          "The image service couldn't use the product photo or prompt.",
        );
      }
      if (err.status === 429 || err.status >= 500) {
        throw new UserError(
          "The image service is busy right now. Please try again in a minute.",
        );
      }
      throw new UserError(
        `The image service returned an error (${err.status}).`,
      );
    }
    if (err instanceof Error && /credentials|FAL_KEY/i.test(err.message)) {
      throw new UserError("The image service has no API key. Check FAL_KEY.");
    }
    throw err;
  }
}
