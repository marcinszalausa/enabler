import assert from "node:assert/strict";
import test from "node:test";
import {imageCapacity} from "../src/lib/trial-capacity.ts";
test("credit capacity describes complete, usable batches",()=>{
 for(const [credits,expected] of [[100,100],[90,90],[95,90],[9,0],[0,0],[-1,0],[NaN,0],[Infinity,0]])assert.equal(imageCapacity(credits,10,10),expected);
 assert.equal(imageCapacity(100,0,10),0);assert.equal(imageCapacity(100,10,0),0);
});
