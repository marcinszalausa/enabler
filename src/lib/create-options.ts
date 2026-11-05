// The create card's chip choices: model, aspect ratio, number of variations
// and what the variations differ in. Provider-free so the browser can show
// them; the models behind each tier live in src/lib/ai/fal.ts.
import { IMAGE_CREDITS, VIDEO_CREDITS_PER_SECOND, type Quality } from "./quality.ts";

// Image ad sizes, square to full screen. Videos are always 9:16.
export const RATIOS = ["1:1", "2:3", "4:5", "9:16"] as const;
export type Ratio = (typeof RATIOS)[number];
export const DEFAULT_RATIO: Ratio = "1:1";

export type Platform = "instagram" | "facebook" | "x" | "linkedin" | "google" | "pinterest" | "tiktok" | "snapchat" | "youtube";
// Where each size fits best, shown as small network marks.
export const RATIO_PLATFORMS: Record<Ratio, Platform[]> = {
  "1:1": ["instagram", "facebook", "x", "linkedin", "google"],
  "2:3": ["instagram", "facebook", "linkedin", "pinterest"],
  "4:5": ["instagram", "facebook", "linkedin"],
  "9:16": ["instagram", "facebook", "tiktok", "snapchat", "youtube"],
};

export function isRatio(value: unknown): value is Ratio {
  return typeof value === "string" && (RATIOS as readonly string[]).includes(value);
}

// 1 to 5 results from one idea; 3 is recommended.
export const VARIATION_COUNTS = [1, 2, 3, 4, 5] as const;
export type VariationCount = (typeof VARIATION_COUNTS)[number];
export const DEFAULT_VARIATIONS: VariationCount = 3;

export function parseVariations(value: unknown): VariationCount | null {
  const n = Number(value);
  return value !== null && value !== "" && (VARIATION_COUNTS as readonly number[]).includes(n) ? (n as VariationCount) : null;
}

// What changes between the variations of one idea.
export const FOCUSES = ["text", "visual", "audience", "style", "composition"] as const;
export type Focus = (typeof FOCUSES)[number];
export const DEFAULT_FOCUS: Focus = "text";

export function parseFocus(value: unknown): Focus {
  return typeof value === "string" && (FOCUSES as readonly string[]).includes(value) ? (value as Focus) : DEFAULT_FOCUS;
}

// One image per variation, in one size.
export function variationRunCost(quality: Quality, variations: number) {
  return variations * IMAGE_CREDITS[quality];
}

// The model behind each quality tier, as the model picker names it.
export type ModelInfo = { name: string; maker: "google" | "flux" | "bytedance" | "kling"; resolution: string };
export const IMAGE_MODELS: Record<Quality, ModelInfo> = {
  best: { name: "Nano Banana Pro", maker: "google", resolution: "2K" },
  better: { name: "Nano Banana 2", maker: "google", resolution: "1K" },
  good: { name: "FLUX.1 Kontext", maker: "flux", resolution: "1K" },
};
export const VIDEO_MODELS: Record<Quality, ModelInfo> = {
  best: { name: "Seedance 2.0", maker: "bytedance", resolution: "1080p" },
  better: { name: "Seedance 2.0", maker: "bytedance", resolution: "720p" },
  good: { name: "Kling 3.0 Pro", maker: "kling", resolution: "1080p" },
};
// Picker order: the strongest first.
export const MODEL_ORDER: Quality[] = ["best", "better", "good"];

export function modelCredits(kind: "image" | "video", quality: Quality) {
  return kind === "image" ? IMAGE_CREDITS[quality] : VIDEO_CREDITS_PER_SECOND[quality];
}

// A run made with Brand DNA off is saved with brand_dna: false. Takes the
// run's request_options, or a creative's embedded generation row.
export function brandDnaOff(run: unknown): boolean {
  const row = Array.isArray(run) ? run[0] : run;
  if (!row || typeof row !== "object") return false;
  const options = "request_options" in row ? (row as { request_options?: unknown }).request_options : row;
  return (options as { brand_dna?: unknown } | null)?.brand_dna === false;
}

// Ads sent out by default: videos and one image per idea. Older runs made
// every idea in 1:1 and 9:16, and only the square went to feeds; runs in one
// chosen size send every image.
export function publishedByDefault(
  c: { kind: string; aspect: string },
  _i: number,
  all: readonly { kind: string; aspect: string }[],
): boolean {
  if (c.kind === "video") return true;
  return c.aspect === "1:1" || !all.some((o) => o.kind === "image" && o.aspect === "1:1");
}

// How a saved ad of each size is shown in lists.
export const ASPECT_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "2:3": "aspect-[2/3]",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
};
export function sizeLabel(aspect: string, words: { feedSize: string; storySize: string }) {
  return aspect === "9:16" ? words.storySize : aspect === "1:1" ? words.feedSize : `${words.feedSize} · ${aspect}`;
}
