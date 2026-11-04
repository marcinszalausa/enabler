import type { Aspect } from "@/lib/ai/fal";
// Provider-free definitions shared by public setup and the image worker.
export const ASPECTS: Aspect[] = ["1:1", "9:16"];
export const ADS_PER_GENERATION = 5;
// 2 credits per image covers generation plus the quality check and retries.
export const CREDITS_PER_IMAGE = 2;
export const GENERATION_COST = ADS_PER_GENERATION * ASPECTS.length * CREDITS_PER_IMAGE;
