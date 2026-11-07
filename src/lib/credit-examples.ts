import {ADS_PER_GENERATION,IMAGES_PER_GENERATION,imageRunCost} from "@/lib/image-pricing";
import {VIDEOS_PER_GENERATION,videoRunCost} from "@/lib/video-options";

// Examples use complete generation batches, not fractional videos or credits.
// The formats are alternatives using the same monthly balance.
export const CREDIT_EXAMPLE_BASIS={imageQuality:"best",videoQuality:"better",videoSeconds:7,imageBatchSize:IMAGES_PER_GENERATION,videoBatchSize:VIDEOS_PER_GENERATION,imageBatchCost:imageRunCost("best",ADS_PER_GENERATION),videoBatchCost:videoRunCost("7","better")} as const;
export function creditExamples(credits:number){
 if(!Number.isSafeInteger(credits)||credits<0)throw new Error("CREDIT_ALLOWANCE_INVALID");
 const imageRuns=Math.floor(credits/CREDIT_EXAMPLE_BASIS.imageBatchCost),videoRuns=Math.floor(credits/CREDIT_EXAMPLE_BASIS.videoBatchCost);
 return {images:imageRuns*CREDIT_EXAMPLE_BASIS.imageBatchSize,videos:videoRuns*CREDIT_EXAMPLE_BASIS.videoBatchSize,seconds:CREDIT_EXAMPLE_BASIS.videoSeconds};
}
