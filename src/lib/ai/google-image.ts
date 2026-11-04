// Nano Banana straight from Google's Gemini API, cheaper than fal for the
// same models. Used only when GEMINI_API_KEY is set; fal stays the backup
// (see generateAdImage in fal.ts).
// Prices (Nov 2026): Nano Banana 2.1 $0.034 per 1K image, Nano Banana Pro
// $0.134 per 2K image. https://ai.google.dev/gemini-api/docs/pricing

export const GOOGLE_IMAGE_MODELS = {
  // Nano Banana 2.1 (Oct 2026): sharper and more realistic than Nano Banana 2,
  // at well under half of fal's Nano Banana 2 price.
  better: { model: "gemini-nano-banana-2.1", size: "1K" },
  best: { model: "gemini-3-pro-image", size: "2K" },
} as const;

export function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function googleImageUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export function googleImageBody(opts: {
  prompt: string;
  image: { mimeType: string; data: string } | null;
  aspect: string;
  size: string;
}) {
  return {
    contents: [{
      role: "user",
      parts: [
        ...(opts.image ? [{ inline_data: { mime_type: opts.image.mimeType, data: opts.image.data } }] : []),
        { text: opts.prompt },
      ],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: opts.aspect, imageSize: opts.size },
    },
  };
}

type Part = { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };
type Response = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

// The first image in Gemini's answer, as raw bytes.
export function googleImageResult(res: Response): { mimeType: string; bytes: Buffer } {
  for (const part of res.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) {
      return {
        mimeType: part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? "image/png",
        bytes: Buffer.from(data, "base64"),
      };
    }
  }
  const reason = res.promptFeedback?.blockReason ?? res.candidates?.[0]?.finishReason ?? "no image";
  throw new Error(`Gemini returned no image (${reason}).`);
}
