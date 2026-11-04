import test from "node:test";
import assert from "node:assert/strict";
import {reviewedCandidate,requireReview,voiceTempo,sampleTimes,QualityError,QualityReviewUnavailableError} from "../src/lib/media-quality-policy.ts";
test("review outages cannot deliver an image or spend another generation attempt",async()=>{
 let generations=0,reviews=0;
 await assert.rejects(reviewedCandidate({generate:async()=>{generations++;return "candidate";},validate:async()=>{},review:async()=>{reviews++;throw Error("offline");}}),QualityReviewUnavailableError);
 assert.equal(generations,1);assert.equal(reviews,2);
});
test("rejected candidates retry with defects and only deliver the approved candidate",async()=>{
 const attempts:Array<{attempt:number;avoid?:string}>=[];
 const result=await reviewedCandidate({generate:async(attempt,avoid)=>{attempts.push({attempt,avoid});return attempt;},validate:async()=>{},review:async candidate=>({ok:candidate===2,issues:candidate===1?"Product changed color":""})});
 assert.equal(result,2);assert.deepEqual(attempts,[{attempt:1,avoid:undefined},{attempt:2,avoid:"Product changed color"}]);
});
test("technical defects and visual defects have a bounded regeneration budget",async()=>{
 let generated=0,reviewed=0;
 await assert.rejects(reviewedCandidate({generate:async()=>++generated,validate:async()=>{throw new QualityError("blank");},review:async()=>{reviewed++;return {ok:true,issues:""};}}),QualityError);
 assert.equal(generated,3);assert.equal(reviewed,0);
 generated=0;
 await assert.rejects(reviewedCandidate({generate:async()=>++generated,validate:async()=>{},review:async()=>({ok:false,issues:"morphing"})}),QualityError);
 assert.equal(generated,3);
});
test("malformed verdicts never approve a result",async()=>{
 await assert.rejects(requireReview(async()=>({ok:"yes",issues:null}) as never),QualityReviewUnavailableError);
 assert.deepEqual(await requireReview(async()=>({ok:false,issues:"  Color\nchanged  "})),{ok:false,issues:"Color changed"});
});
test("voiceover must fit without cutting words or excessive acceleration",()=>{
 assert.equal(voiceTempo(5,7),1);
 assert.ok(voiceTempo(7,7)<=1.2);
 assert.throws(()=>voiceTempo(9,7),QualityError);
 for(const seconds of [NaN,Infinity,-1,0])assert.throws(()=>voiceTempo(seconds,7),QualityError);
});
test("every shot contributes beginning, middle and ending review samples",()=>{
 for(const seconds of [3,4,5,7,15]){
  const times=sampleTimes(seconds);assert.equal(times.length,3);
  assert.ok(times[0]<.1&&times[1]===seconds/2&&times[2]>seconds-.2&&times[2]<seconds);
 }
 assert.throws(()=>sampleTimes(0),QualityError);
});

test("an approval with reported defects cannot pass review",async()=>{
 await assert.rejects(requireReview(async()=>({ok:true,issues:"Product changed color"})),QualityReviewUnavailableError);
});
