import "server-only";
import { ApiError, fal } from "@fal-ai/client";
import { UserError } from "@/lib/errors";

export type Aspect = "1:1" | "9:16";

type FalImageOutput = { images: { url: string }[] };

// Product photo available: edit it into a new scene so the real product shows.
// Otherwise: generate the scene from text alone.
export async function generateAdImage(opts: {
  prompt: string;
  aspect: Aspect;
  referenceImageUrl: string | null;
}): Promise<string> {
  const prompt = `${opts.prompt}. Professional advertising photograph, clean composition, leave calm empty space near the top for a headline. No text, letters, logos or watermarks.`;

  const result = await callFal(() =>
    opts.referenceImageUrl
      ? fal.subscribe("fal-ai/flux-pro/kontext", {
          input: {
            prompt: `Place this exact product in a new scene: ${prompt}`,
            image_url: opts.referenceImageUrl,
            aspect_ratio: opts.aspect,
            output_format: "jpeg",
          },
        })
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

// Turns fal failures into messages that point at the likely fix.
// The full error still goes to the server log.
async function callFal<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
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
