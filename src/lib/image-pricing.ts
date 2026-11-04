import type { Aspect } from "@/lib/ai/fal";
import { DEFAULT_IMAGE_QUALITY, IMAGE_CREDITS, type Quality } from "@/lib/quality";
// Provider-free definitions shared by public setup and the image worker.
export const ASPECTS: Aspect[] = ["1:1", "9:16"];
// Ad ideas (angles) per image run, each made in every size. The owner picks
// 1, 3 or 5; 5 is the default and what runs from before the choice made.
export const IDEA_COUNTS = [1, 3, 5] as const;
export type IdeaCount = (typeof IDEA_COUNTS)[number];
export const ADS_PER_GENERATION: IdeaCount = 5;
export const IMAGES_PER_GENERATION = ADS_PER_GENERATION * ASPECTS.length;

export function parseIdeas(value: unknown): IdeaCount {
  const n = Number(value);
  return (IDEA_COUNTS as readonly number[]).includes(n) ? (n as IdeaCount) : ADS_PER_GENERATION;
}

export function imageRunCost(quality: Quality = DEFAULT_IMAGE_QUALITY, ideas: IdeaCount = ADS_PER_GENERATION) {
  return ideas * ASPECTS.length * IMAGE_CREDITS[quality];
}

// The default tier's prices, used where no tier has been picked yet.
export const CREDITS_PER_IMAGE = IMAGE_CREDITS[DEFAULT_IMAGE_QUALITY];
export const GENERATION_COST = imageRunCost();
