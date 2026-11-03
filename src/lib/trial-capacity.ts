// Credits are spent in complete image batches; never promise unusable leftovers.
export function imageCapacity(credits:number,batchCost:number,batchSize:number):number{
 if(!Number.isFinite(credits)||credits<0||!Number.isFinite(batchCost)||batchCost<=0||!Number.isSafeInteger(batchSize)||batchSize<=0)return 0;
 return Math.floor(credits/batchCost)*batchSize;
}
