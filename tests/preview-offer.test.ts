import assert from "node:assert/strict";
import test from "node:test";
import {PREVIEW_OFFER} from "../src/lib/preview-offer.ts";
import {DEFAULT_VARIATIONS,variationRunCost} from "../src/lib/create-options.ts";
import {DEFAULT_IMAGE_QUALITY} from "../src/lib/quality.ts";
import {videoRunCost,DEFAULT_VIDEO_OPTIONS} from "../src/lib/video-options.ts";
import {growthTests} from "../src/lib/growth-testing.ts";
import {SCALE_SAMPLE_ROWS,sampleCampaignBrief} from "../src/lib/offer-examples.ts";

test("a new verified preview can afford the displayed creation choices",()=>{
 assert.equal(PREVIEW_OFFER.credits,100);
 assert.equal(PREVIEW_OFFER.image.count,DEFAULT_VARIATIONS);assert.equal(PREVIEW_OFFER.image.quality,DEFAULT_IMAGE_QUALITY);
 assert.equal(PREVIEW_OFFER.image.cost,variationRunCost(DEFAULT_IMAGE_QUALITY,DEFAULT_VARIATIONS));
 assert.equal(PREVIEW_OFFER.video.cost,videoRunCost(DEFAULT_VIDEO_OPTIONS.length,PREVIEW_OFFER.video.quality));
 assert.ok(PREVIEW_OFFER.image.cost<=PREVIEW_OFFER.credits);assert.ok(PREVIEW_OFFER.video.cost<=PREVIEW_OFFER.credits);
 assert.deepEqual([PREVIEW_OFFER.image.count,PREVIEW_OFFER.image.cost,PREVIEW_OFFER.video.quality,PREVIEW_OFFER.video.cost],[3,15,"good",60]);
});
test("public Scale sample uses real recommendation logic and labels invented metrics",()=>{
 assert.equal(growthTests(SCALE_SAMPLE_ROWS).length,1);assert.equal(growthTests([]).length,0);
 const brief=sampleCampaignBrief();assert.ok(brief.startsWith("ILLUSTRATIVE SAMPLE — NOT CUSTOMER RESULTS"));assert.match(brief,/Starting post: sample-benefit/);assert.match(brief,/change one headline or opening scene/);assert.match(brief,/not controlled A\/B tests/);
});
