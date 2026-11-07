import "server-only";
import {generateCatalogModelImage,type CatalogModel} from "@/lib/catalog/model-inference";
import { fetchPublicUrl, verifyPublicUrl } from "@/lib/public-fetch";
import { ApiError, fal } from "@fal-ai/client";
import { UserError } from "@/lib/errors";
import type { Quality } from "@/lib/quality";
import { gatewayKey, getGatewaySeedance, submitGatewaySeedance } from "@/lib/ai/gateway-video";
import { GOOGLE_IMAGE_MODELS, geminiKey, googleImageBody, googleImageResult, googleImageUrl } from "@/lib/ai/google-image";
import { createAdminClient } from "@/lib/supabase/admin";

export type Aspect = "1:1" | "2:3" | "4:5" | "9:16";

// FLUX Kontext has no 4:5; it draws 3:4 and the ad is cropped to 4:5.
export function modelAspect(aspect: Aspect, quality: Quality): Aspect | "3:4" {
  return quality === "good" && aspect === "4:5" ? "3:4" : aspect;
}
// FLUX dev takes pixel sizes (multiples of 16) instead of a ratio.
const FLUX_TEXT_SIZES: Record<Aspect, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "2:3": { width: 832, height: 1248 },
  "4:5": { width: 896, height: 1120 },
  "9:16": { width: 768, height: 1344 },
};

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
  catalogModel?:CatalogModel|null;
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
  // A style reference the owner picked: its look is followed, never its
  // product, people or text. `style` describes it in words, for models that
  // take a single image and for uploads, which have no description.
  styleImageUrl?: string | null;
  style?: string | null;
  // An AI avatar the owner picked to feature as the ad's model; `person`
  // describes them in words, for models that take a single image.
  personImageUrl?: string | null;
  person?: string | null;
}): Promise<string> {
  const referenceImageUrl = opts.referenceImageUrl
    ? (await verifyPublicUrl(opts.referenceImageUrl)).toString() : null;
  // Only the product shot takes the style; a new framing of an earlier shot
  // already carries it.
  const styleImageUrl = opts.styleImageUrl && !opts.sameScene
    ? (await verifyPublicUrl(opts.styleImageUrl)).toString() : null;
  const styleText = opts.sameScene ? null : opts.style?.trim() || null;
  // A new framing already shows the avatar, so only the first shot takes it.
  const personImageUrl = opts.personImageUrl && !opts.sameScene
    ? (await verifyPublicUrl(opts.personImageUrl)).toString() : null;
  const personText = opts.sameScene ? null : opts.person?.trim() || null;
  const prompt = `${opts.prompt}. Professional advertising photograph with sharp product detail, believable material texture, natural skin and coherent lighting. Keep every visible face fully inside the image with comfortable headroom. Compose a full-frame photograph with quiet negative space around the subject for separately rendered ad copy; do not shrink the subject into a framed inset. Preserve the product silhouette, color, material, construction and genuine branding from the reference. Keep natural pairs and sets intact, with no duplicated extra variants. Hands should look natural; fingers may be naturally occluded. No added headlines, captions, invented lettering or watermarks.${opts.avoid ? ` Avoid these problems: ${opts.avoid}.` : ""}`;
  const models = IMAGE_MODELS[opts.quality];
  if(opts.catalogModel&&!opts.sameScene&&!opts.personImageUrl&&!opts.person){
    return generateCatalogModelImage(opts.catalogModel,prompt+(opts.style?" Visual style: "+opts.style:""),opts.aspect);
  }
  const flux = opts.quality === "good";
  const aspect = modelAspect(opts.aspect, opts.quality);
  // Flux Kontext takes one image, so it gets the avatar and style in words only.
  // The other models see them as extra images after the product photo (with
  // no product photo, the text models get words too).
  const images = !flux && referenceImageUrl;
  const extraImages: string[] = [];
  let guide = "";
  const nth = () => ["second", "third", "fourth"][extraImages.length - 1];
  if (personImageUrl && images) {
    extraImages.push(personImageUrl);
    guide += ` Feature the person from the ${nth()} image as the model in this ad, keeping their face, hair, skin tone and build recognizably the same and styling them naturally for the scene. They replace any other person the scene describes; no other people appear. Do not copy that image's background.${personText ? ` They are ${personText}.` : ""}`;
  } else if (personText) {
    guide += ` Feature this person as the model in the ad: ${personText}.`;
  }
  if (styleImageUrl && images) {
    extraImages.push(styleImageUrl);
    guide += ` Use the ${nth()} image only as a style reference: match its composition, camera angle, kind of setting, lighting and mood. Do not copy its product, its people's faces, or any text or logo from it.${styleText ? ` Style: ${styleText}.` : ""}`;
  } else if (styleText) {
    guide += ` Visual style to follow: ${styleText}.`;
  }
  const editBase = opts.sameScene
    ? `Show the same person, wearing exactly the same outfit, in the same setting and light as this image, from a new framing. The product keeps its color, fabric and design unchanged: ${prompt}`
    : `Place this exact product in a new scene, keeping its color, fabric and design unchanged. Keep natural pairs or sets intact, without duplicating the product or introducing a different color variant: ${prompt}`;
  const editPrompt = editBase + guide;

  const google = opts.quality === "good" ? null : geminiKey();
  if (google) {
    // Nano Banana direct from Google costs less than fal; fal is the backup.
    try {
      return await generateGoogleImage({
        prompt: referenceImageUrl ? editPrompt : prompt + guide,
        referenceImageUrls: referenceImageUrl ? [referenceImageUrl, ...extraImages] : [],
        aspect,
        ...GOOGLE_IMAGE_MODELS[opts.quality as "better" | "best"],
        key: google,
      });
    } catch (err) {
      console.error("Gemini image failed, drawing on fal instead", err);
    }
  }

  const result = await callFal(() =>
    referenceImageUrl
      ? fal.subscribe(opts.retry ? models.retry : models.edit, {
          input: flux
            ? { prompt: editPrompt, image_url: referenceImageUrl, aspect_ratio: aspect, output_format: "jpeg" }
            : { prompt: editPrompt, image_urls: [referenceImageUrl, ...extraImages], aspect_ratio: aspect, output_format: "jpeg", num_images: 1, ...models.input },
        })
      : fal.subscribe(models.text, {
          input: flux
            ? { prompt: prompt + guide, image_size: FLUX_TEXT_SIZES[opts.aspect], output_format: "jpeg" }
            : { prompt: prompt + guide, aspect_ratio: aspect, output_format: "jpeg", num_images: 1, ...models.input },
        }),
  );

  const url = (result.data as FalImageOutput).images?.[0]?.url;
  if (!url) throw new Error("Image generation returned no image.");
  return url;
}

// One image for Gooidy's style or avatar library, or a custom avatar, at 3:4.
// Nano Banana 2 by default (a few cents); custom avatars ask for Nano Banana
// Pro. A reference photo (an owner's own portrait) is followed when given.
// Google direct when set up, else fal.
export async function generateLibraryImage(prompt: string, opts: { quality?: "better" | "best"; referenceImageUrl?: string | null } = {}): Promise<string> {
  const quality = opts.quality ?? "better";
  const reference = opts.referenceImageUrl ? (await verifyPublicUrl(opts.referenceImageUrl)).toString() : null;
  const google = geminiKey();
  if (google) {
    try {
      return await generateGoogleImage({ prompt, referenceImageUrls: reference ? [reference] : [], aspect: "3:4", ...GOOGLE_IMAGE_MODELS[quality], key: google });
    } catch (err) {
      console.error("Gemini library image failed, drawing on fal instead", err);
    }
  }
  const model = IMAGE_MODELS[quality];
  const result = await callFal(() => fal.subscribe(reference ? model.edit : model.text, {
    input: { prompt, ...(reference ? { image_urls: [reference] } : {}), aspect_ratio: "3:4", output_format: "jpeg", num_images: 1, resolution: "1K" },
  }));
  const url = (result.data as FalImageOutput).images?.[0]?.url;
  if (!url) throw new Error("Image generation returned no image.");
  return url;
}

// Gemini answers with the image itself, which is kept in storage briefly.
async function generateGoogleImage(opts: {
  prompt: string;
  referenceImageUrls: string[];
  aspect: Aspect | "3:4";
  model: string;
  size: string;
  key: string;
}): Promise<string> {
  const images = await Promise.all(opts.referenceImageUrls.map(async (url) => {
    const ref = await fetchPublicUrl(url, { maxBytes: 15 * 1024 * 1024, timeoutMs: 30000, accept: "image/*" });
    if (ref.status < 200 || ref.status >= 300) throw new Error(`Reference image returned ${ref.status}.`);
    return { mimeType: ref.contentType.startsWith("image/") ? ref.contentType : "image/jpeg", data: ref.body.toString("base64") };
  }));
  const res = await fetch(googleImageUrl(opts.model), {
    method: "POST",
    headers: { "x-goog-api-key": opts.key, "Content-Type": "application/json" },
    body: JSON.stringify(googleImageBody({ prompt: opts.prompt, images, aspect: opts.aspect, size: opts.size })),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  const { mimeType, bytes } = googleImageResult(body);
  return storeGenerated(bytes, mimeType, mimeType === "image/jpeg" ? "jpg" : "png");
}

// Keeps media a provider returned as bytes in storage for a few hours and
// hands it on as a signed URL, like fal's hosted results.
async function storeGenerated(bytes: Buffer, contentType: string, ext: string): Promise<string> {
  const path = `provider-media/${crypto.randomUUID()}.${ext}`;
  const storage = createAdminClient().storage.from("creatives");
  const { error } = await storage.upload(path, bytes, { contentType });
  if (error) throw error;
  const { data, error: signError } = await storage.createSignedUrl(path, 6 * 3600);
  if (signError || !data) throw signError ?? new Error("Could not sign the media URL.");
  return data.signedUrl;
}

// The video models behind each quality tier. Good: Kling 3 Pro (1080p).
// Better and Best: Seedance 2.0, top of the image-to-video arena, at 720p
// and 1080p. Seedance films at least 4 s; shorter shots are trimmed in the edit.
const KLING = "fal-ai/kling-video/v3/pro/image-to-video";
const SEEDANCE = "bytedance/seedance-2.0/image-to-video";
const SEEDANCE_RESOLUTION: Partial<Record<Quality, string>> = { better: "720p", best: "1080p" };
const SEEDANCE_MIN_SECONDS = 4;
// A clip reference is "<model>::<request id>" (or "gateway/seedance-2.0::<operation JSON>"); a bare id is from before
// tiers existed, when every clip was filmed on Kling.
const REF_SEPARATOR = "::";
// Clips filmed through Vercel AI Gateway instead of fal; their reference
// carries the gateway's operation as JSON.
const GATEWAY = "gateway/seedance-2.0";

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
  if (resolution && gatewayKey()) {
    // Seedance through Vercel AI Gateway costs about half of fal; fal is the backup.
    try {
      const operation = await submitGatewaySeedance({
        prompt: `${prompt} One continuous shot. Avoid ${avoid}.`,
        imageUrl: startImageUrl,
        seconds: Math.max(SEEDANCE_MIN_SECONDS, Math.ceil(opts.seconds)),
        resolution,
      });
      return `${GATEWAY}${REF_SEPARATOR}${operation}`;
    } catch (err) {
      console.error("AI Gateway Seedance failed, filming on fal instead", err);
    }
  }
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
  if (model === GATEWAY) {
    const result = await getGatewaySeedance(requestId);
    if (!result || "url" in result) return result?.url ?? null;
    return storeGenerated(result.bytes, result.mediaType, "mp4");
  }
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
