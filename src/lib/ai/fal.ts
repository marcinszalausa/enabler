import "server-only";
import { verifyPublicUrl } from "@/lib/public-fetch";
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
  // The reference is an earlier shot of the same ad: keep its person,
  // outfit and setting, and change only the framing.
  sameScene?: boolean;
  aspect: Aspect;
  referenceImageUrl: string | null;
}): Promise<string> {
  const referenceImageUrl = opts.referenceImageUrl
    ? (await verifyPublicUrl(opts.referenceImageUrl)).toString() : null;
  const prompt = `${opts.prompt}. Professional advertising photograph, clean composition, leave calm empty space near the top for a headline. Anatomically correct hands with five fingers each, relaxed and natural. No text, letters, logos or watermarks.${opts.avoid ? ` Avoid these problems: ${opts.avoid}.` : ""}`;

  const result = await callFal(() =>
    referenceImageUrl
      ? fal.subscribe(
          opts.best ? "fal-ai/flux-pro/kontext/max" : "fal-ai/flux-pro/kontext",
          {
            input: {
              prompt: opts.sameScene
                ? `Show the same person, wearing exactly the same outfit, in the same setting and light as this image, from a new framing. The product keeps its color, fabric and design unchanged: ${prompt}`
                : `Place this exact product in a new scene, keeping its color, fabric and design unchanged. Show it only once; nobody else in the scene wears or holds a similar item in another color: ${prompt}`,
              image_url: referenceImageUrl,
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

export const VIDEO_MODEL = "fal-ai/kling-video/v3/pro/image-to-video";

// Video clips take minutes, longer than a request should wait, so they go
// through fal's queue: submit now, collect the result on a later check.
export async function submitAdVideo(opts: {
  startImageUrl: string;
  prompt: string;
  seconds: number;
}): Promise<string> {
  const startImageUrl = (await verifyPublicUrl(opts.startImageUrl)).toString();
  const { request_id } = await callFal(() =>
    fal.queue.submit(VIDEO_MODEL, {
      input: {
        prompt: `${opts.prompt} Vertical social video ad, photorealistic, steady and smooth. The product keeps exactly the color, fabric and design of the first frame. Natural hands and faces.`,
        start_image_url: startImageUrl,
        duration: String(opts.seconds) as "5",
        negative_prompt:
          "blur, distortion, warped hands, extra fingers, morphing product, color change, text, subtitles, watermark, low quality",
        // Sound is added later: a voiceover and a music bed.
        generate_audio: false,
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
