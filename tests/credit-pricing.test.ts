import assert from "node:assert/strict";
import test from "node:test";
import {CREDITS_PER_IMAGE, GENERATION_COST} from "../src/lib/image-pricing.ts";

test("image runs cost 2 credits per image, 20 per run",()=>{
 assert.equal(CREDITS_PER_IMAGE,2);
 assert.equal(GENERATION_COST,20);
});
