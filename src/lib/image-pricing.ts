import type { Aspect } from "@/lib/ai/fal";
import { DEFAULT_IMAGE_QUALITY, IMAGE_CREDITS, type Quality } from "@/lib/quality";
// Provider-free definitions shared by public setup and the image worker.
export const ASPECTS: Aspect[] = ["1:1", "9:16"];
export const ADS_PER_GENERATION = 5;
export const IMAGES_PER_GENERATION = ADS_PER_GENERATION * ASPECTS.length;

export function imageRunCost(quality: Quality = DEFAULT_IMAGE_QUALITY) {
  return IMAGES_PER_GENERATION * IMAGE_CREDITS[quality];
}

// The default tier's prices, used where no tier has been picked yet.
export const CREDITS_PER_IMAGE = IMAGE_CREDITS[DEFAULT_IMAGE_QUALITY];
export const GENERATION_COST = imageRunCost();
