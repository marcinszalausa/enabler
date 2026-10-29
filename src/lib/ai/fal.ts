import "server-only";
import { fal } from "@fal-ai/client";

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

  const result = opts.referenceImageUrl
    ? await fal.subscribe("fal-ai/flux-pro/kontext", {
        input: {
          prompt: `Place this exact product in a new scene: ${prompt}`,
          image_url: opts.referenceImageUrl,
          aspect_ratio: opts.aspect,
          output_format: "jpeg",
        },
      })
    : await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt,
          image_size: opts.aspect === "1:1" ? "square_hd" : "portrait_16_9",
        },
      });

  const url = (result.data as FalImageOutput).images?.[0]?.url;
  if (!url) throw new Error("Image generation returned no image.");
  return url;
}
