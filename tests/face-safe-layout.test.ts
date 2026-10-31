import assert from "node:assert/strict";
import test from "node:test";
import {IMAGE_REGIONS,VIDEO_REGIONS,overlaps} from "../src/lib/face-safe-layout.ts";
test("all image copy and logo regions are outside the entire source photo",()=>{
 for(const r of Object.values(IMAGE_REGIONS)){assert.equal(overlaps(r.media,r.headline),false);assert.equal(overlaps(r.media,r.footer),false);}
});
test("video text never intersects the footage, regardless of subject position or motion",()=>{
 assert.equal(overlaps(VIDEO_REGIONS.media,VIDEO_REGIONS.hook),false);
 assert.equal(overlaps(VIDEO_REGIONS.media,VIDEO_REGIONS.caption),false);
 assert.equal(overlaps(VIDEO_REGIONS.hook,VIDEO_REGIONS.caption),false);
 assert.ok(VIDEO_REGIONS.caption.y+VIDEO_REGIONS.caption.height<=1700,"captions above lower platform controls");
});
