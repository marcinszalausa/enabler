import {TRY_MODE} from "./paid-plans.ts";
import {DEFAULT_VARIATIONS,variationRunCost} from "./create-options.ts";
import {DEFAULT_IMAGE_QUALITY,DEFAULT_VIDEO_QUALITY,QUALITIES} from "./quality.ts";
import {DEFAULT_VIDEO_OPTIONS,VIDEOS_PER_GENERATION,videoRunCost} from "./video-options.ts";

// Match the real creation controls for a newly verified preview account.
const videoQuality=[...QUALITIES].reverse().find(q=>QUALITIES.indexOf(q)<=QUALITIES.indexOf(DEFAULT_VIDEO_QUALITY)&&videoRunCost(DEFAULT_VIDEO_OPTIONS.length,q)<=TRY_MODE.credits)??"good";
export const PREVIEW_OFFER={credits:TRY_MODE.credits,image:{count:DEFAULT_VARIATIONS,quality:DEFAULT_IMAGE_QUALITY,cost:variationRunCost(DEFAULT_IMAGE_QUALITY,DEFAULT_VARIATIONS)},video:{count:VIDEOS_PER_GENERATION,quality:videoQuality,seconds:Number(DEFAULT_VIDEO_OPTIONS.length),cost:videoRunCost(DEFAULT_VIDEO_OPTIONS.length,videoQuality)}} as const;
