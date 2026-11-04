import "server-only";
import { verifyPublicUrl } from "@/lib/public-fetch";
import { ApiError, fal } from "@fal-ai/client";
import { UserError } from "@/lib/errors";
import type { Quality } from "@/lib/quality";

export type Aspect = "1:1" | "9:16";

type FalImageOutput = { images: { url: string }[] };

// The image models behind each quality tier. With a product photo the edit
// model puts the real product in a new scene; without one, the text model
// draws the scene. Good retries on the more precise Kontext Max.
const IMAGE_MODELS: Record<Quality, { edit: string; retry: string; text: string; input: Record<string, string> }> = {
  good: { edit: "fal-ai/flux-pro/kontext", retry: "fal-ai/flux-pro/kontext/max", text: "fal-ai/flux/dev", input: {} },
  better: { edit: "fal-ai/nano-banana-2/edit", retry: "fal-ai/nano-banana-2/edit", text: "fal-ai/nano-banana-2", input: { resolution: "1K" } },
  best: { edit: "fal-ai/nano-banana-pro/edit", retry: "fal-ai/nano-banana-pro/edit", text: "fal-ai/nano-banana-pro", input: { resolution: "2K" } },
};

export async function generateAdImage(opts: {
  prompt: string;
  quality: Quality;
  // Defects a reviewer found in an earlier try, to steer away from.
  avoid?: string;
  // A later try: Good switches to the more precise Kontext Max.
  retry?: boolean;
  // The reference is an earlier shot of the same ad: keep its person,
  // outfit and setting, and change only the framing.
  sameScene?: boolean;
  aspect: Aspect;
  referenceImageUrl: string | null;
}): Promise<string> {
  const referenceImageUrl = opts.referenceImageUrl
    ? (await verifyPublicUrl(opts.referenceImageUrl)).toString() : null;
  const prompt = `${opts.prompt}. Professional advertising photograph with sharp product detail, believable material texture, natural skin and coherent lighting. Keep every visible face fully inside the image with comfortable headroom. Compose a full-frame photograph with quiet negative space around the subject for separately rendered ad copy; do not shrink the subject into a framed inset. Preserve the product silhouette, color, material, construction and genuine branding from the reference. Keep natural pairs and sets intact, with no duplicated extra variants. Hands should look natural; fingers may be naturally occluded. No added headlines, captions, invented lettering or watermarks.${opts.avoid ? ` Avoid these problems: ${opts.avoid}.` : ""}`;
  const models = IMAGE_MODELS[opts.quality];
  const flux = opts.quality === "good";
  const editPrompt = opts.sameScene
    ? `Show the same person, wearing exactly the same outfit, in the same setting and light as this image, from a new framing. The product keeps its color, fabric and design unchanged: ${prompt}`
    : `Place this exact product in a new scene, keeping its color, fabric and design unchanged. Keep natural pairs or sets intact, without duplicating the product or introducing a different color variant: ${prompt}`;

  const result = await callFal(() =>
    referenceImageUrl
      ? fal.subscribe(opts.retry ? models.retry : models.edit, {
          input: flux
            ? { prompt: editPrompt, image_url: referenceImageUrl, aspect_ratio: opts.aspect, output_format: "jpeg" }
            : { prompt: editPrompt, image_urls: [referenceImageUrl], aspect_ratio: opts.aspect, output_format: "jpeg", num_images: 1, ...models.input },
        })
      : fal.subscribe(models.text, {
          input: flux
            ? { prompt, image_size: opts.aspect === "1:1" ? { width: 1024, height: 1024 } : { width: 768, height: 1344 }, output_format: "jpeg" }
            : { prompt, aspect_ratio: opts.aspect, output_format: "jpeg", num_images: 1, ...models.input },
        }),
  );

  const url = (result.data as FalImageOutput).images?.[0]?.url;
  if (!url) throw new Error("Image generation returned no image.");
  return url;
}

// The video models behind each quality tier. Good: Kling 3 Pro (1080p).
// Better and Best: Seedance 2.0, top of the image-to-video arena, at 720p
// and 1080p. Seedance films at least 4 s; shorter shots are trimmed in the edit.
const KLING = "fal-ai/kling-video/v3/pro/image-to-video";
const SEEDANCE = "bytedance/seedance-2.0/image-to-video";
const SEEDANCE_RESOLUTION: Partial<Record<Quality, string>> = { better: "720p", best: "1080p" };
const SEEDANCE_MIN_SECONDS = 4;
// A clip reference is "<model>::<request id>"; a bare id is from before
// tiers existed, when every clip was filmed on Kling.
const REF_SEPARATOR = "::";

// Video clips take minutes, longer than a request should wait, so they go
// through fal's queue: submit now, collect the result on a later check.
export async function submitAdVideo(opts: {
  startImageUrl: string;
  prompt: string;
  seconds: number;
  quality: Quality;
}): Promise<string> {
  const startImageUrl = (await verifyPublicUrl(opts.startImageUrl)).toString();
  const prompt = `${opts.prompt} Vertical social video ad, photorealistic, steady and smooth. The product keeps exactly the color, fabric and design of the first frame. If people are present, keep natural anatomy and faces fully inside the frame throughout the motion. Do not introduce new people or extra product variants. Do not add on-screen text, captions or watermarks; preserve genuine product labels and branding from the first frame.`;
  const avoid = "blur, distortion, warped hands, extra fingers, morphing product, color change, added subtitles, garbled branding, watermark, low quality";
  const resolution = SEEDANCE_RESOLUTION[opts.quality];
  const model = resolution ? SEEDANCE : KLING;
  const { request_id } = await callFal(() =>
    fal.queue.submit(model, {
      // Sound is added later: a voiceover and a music bed.
      input: resolution
        ? {
            prompt: `${prompt} One continuous shot. Avoid ${avoid}.`,
            image_url: startImageUrl,
            duration: String(Math.max(SEEDANCE_MIN_SECONDS, Math.ceil(opts.seconds))),
            resolution,
            aspect_ratio: "9:16",
            generate_audio: false,
          }
        : {
            prompt,
            start_image_url: startImageUrl,
            duration: String(opts.seconds),
            negative_prompt: avoid,
            generate_audio: false,
          },
    }),
  );
  return `${model}${REF_SEPARATOR}${request_id}`;
}

// The finished clip's URL, null while the model is still working.
// Throws if the model failed on it.
export async function getAdVideo(ref: string): Promise<string | null> {
  const split = ref.indexOf(REF_SEPARATOR);
  const model = split < 0 ? KLING : ref.slice(0, split);
  const requestId = split < 0 ? ref : ref.slice(split + REF_SEPARATOR.length);
  const status = await callFal(() => fal.queue.status(model, { requestId }));
  if (status.status !== "COMPLETED") return null;
  const result = await callFal(() => fal.queue.result(model, { requestId }));
  const url = (result.data as { video?: { url?: string } }).video?.url;
  if (!url) throw new Error("Video generation returned no video.");
  return url;
}

// The ad's voiceover as an MP3 URL. `voice` is an ElevenLabs voice name;
// `tag` an audio tag that sets the delivery, e.g. "[excited]".
export async function generateVoiceover(opts: {
  text: string;
  voice: string;
  tag: string;
  languageCode: string;
}): Promise<string> {
  const speak = (voice?: string) =>
    callFal(() =>
      fal.subscribe("fal-ai/elevenlabs/tts/eleven-v3", {
        input: {
          text: `${opts.tag} ${opts.text}`,
          voice,
          language_code: opts.languageCode,
        },
      }),
    );
  let result;
  try {
    result = await speak(opts.voice);
  } catch (err) {
    // An unknown voice name shouldn't sink the ad; use the default voice.
    console.error("voiceover failed, retrying with default voice", err);
    result = await speak();
  }
  const url = (result.data as { audio?: { url?: string } }).audio?.url;
  if (!url) throw new Error("Voiceover returned no audio.");
  return url;
}

// Instrumental background music of the given length, as a WAV URL.
export async function generateMusic(opts: {
  prompt: string;
  seconds: number;
}): Promise<string> {
  const result = await callFal(() =>
    fal.subscribe("fal-ai/stable-audio-25/text-to-audio", {
      input: {
        prompt: `${opts.prompt}. Instrumental background music for a short social video ad, no vocals, clean mix, steady from start to end.`,
        seconds_total: opts.seconds,
      },
    }),
  );
  const url = (result.data as { audio?: { url?: string } }).audio?.url;
  if (!url) throw new Error("Music generation returned no audio.");
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
        // fal says why (e.g. a locked account or a model needing access).
        const detail = (err.body as { detail?: unknown } | undefined)?.detail;
        throw new UserError(
          `The AI media service (fal) refused the request${typeof detail === "string" ? `: ${detail}` : ""}. Check FAL_KEY and fal billing.`,
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
