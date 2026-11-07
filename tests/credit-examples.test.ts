import assert from "node:assert/strict";
import test from "node:test";
import {creditExamples,CREDIT_EXAMPLE_BASIS as basis} from "../src/lib/credit-examples.ts";
import {PAID_PLANS} from "../src/lib/paid-plans.ts";
import {imageRunCost} from "../src/lib/image-pricing.ts";
import {videoRunCost} from "../src/lib/video-options.ts";

test("public examples respect complete paid-generation batches for every plan",()=>{
 assert.deepEqual(PAID_PLANS.map(p=>creditExamples(p.credits)),[{images:60,videos:4,seconds:7},{images:120,videos:8,seconds:7},{images:200,videos:14,seconds:7}]);
 for(const plan of PAID_PLANS){
  const example=creditExamples(plan.credits),imageSpend=example.images/basis.imageBatchSize*imageRunCost("best"),videoSpend=example.videos/basis.videoBatchSize*videoRunCost("7","better");
  assert.equal(example.images%basis.imageBatchSize,0);assert.equal(example.videos%basis.videoBatchSize,0);
  assert.ok(imageSpend<=plan.credits&&plan.credits-imageSpend<imageRunCost("best"));
  assert.ok(videoSpend<=plan.credits&&plan.credits-videoSpend<videoRunCost("7","better"));
 }
});
test("insufficient allowances cannot advertise fractional image or video batches",()=>{
 assert.deepEqual(creditExamples(0),{images:0,videos:0,seconds:7});
 assert.equal(creditExamples(basis.imageBatchCost-1).images,0);
 assert.equal(creditExamples(basis.videoBatchCost-1).videos,0);
 for(const credits of [-1,0.5,NaN,Infinity])assert.throws(()=>creditExamples(credits),/CREDIT_ALLOWANCE_INVALID/);
});
