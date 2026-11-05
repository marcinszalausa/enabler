import assert from "node:assert/strict";
import test from "node:test";
import {DEFAULT_IMAGE_QUALITY,DEFAULT_VIDEO_QUALITY,IMAGE_CREDITS,VIDEO_CREDITS_PER_SECOND,parseQuality} from "../src/lib/quality.ts";

test("higher tiers cost more credits",()=>{
 assert.ok(IMAGE_CREDITS.good<IMAGE_CREDITS.better&&IMAGE_CREDITS.better<IMAGE_CREDITS.best);
 assert.ok(VIDEO_CREDITS_PER_SECOND.good<VIDEO_CREDITS_PER_SECOND.better&&VIDEO_CREDITS_PER_SECOND.better<VIDEO_CREDITS_PER_SECOND.best);
});
test("tier prices keep a credit's worst-case provider cost near 5 cents",()=>{
 // Worst-case dollars per image (first try, check, two retries) and per video second.
 const image={good:0.092,better:0.132,best:0.229},second={good:0.112+0.06,better:0.3034*8/7+0.08,best:0.682*8/7+0.09};
 for(const q of ["good","better","best"] as const){
  assert.ok(image[q]/IMAGE_CREDITS[q]<=0.051,q);
  assert.ok(second[q]/VIDEO_CREDITS_PER_SECOND[q]<=0.051,q);
 }
});
test("unknown tiers fall back",()=>{
 assert.equal(parseQuality("premium",DEFAULT_IMAGE_QUALITY),"best");
 assert.equal(parseQuality(null,DEFAULT_VIDEO_QUALITY),"better");
 assert.equal(parseQuality("good","best"),"good");
});
