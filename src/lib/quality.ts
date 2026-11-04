// Quality tiers the owner picks per run. Provider-free so the browser can
// show prices; the models behind each tier live in src/lib/ai/fal.ts.
// Each tier's price keeps a credit's worst-case cost (every try, retries and
// first frames included) at about 5 cents, under what a Pro credit earns.
export const QUALITIES = ["good", "better", "best"] as const;
export type Quality = (typeof QUALITIES)[number];

// Images start on Best (the first impression sells the product); videos on
// Better, so a short video stays affordable.
export const DEFAULT_IMAGE_QUALITY: Quality = "best";
export const DEFAULT_VIDEO_QUALITY: Quality = "better";

// Good: FLUX Kontext. Better: Nano Banana 2. Best: Nano Banana Pro at 2K.
export const IMAGE_CREDITS: Record<Quality, number> = { good: 2, better: 3, best: 5 };
// Good: Kling 3 Pro 1080p. Better: Seedance 2.0 720p. Best: Seedance 2.0 1080p.
export const VIDEO_CREDITS_PER_SECOND: Record<Quality, number> = { good: 4, better: 9, best: 18 };

export function isQuality(value: unknown): value is Quality {
  return typeof value === "string" && (QUALITIES as readonly string[]).includes(value);
}

export function parseQuality(value: unknown, fallback: Quality): Quality {
  return isQuality(value) ? value : fallback;
}

