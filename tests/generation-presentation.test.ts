import assert from "node:assert/strict";
import test from "node:test";
import { generationPresentation, settledCredits, type RunSnapshot } from "../src/lib/generation-presentation.ts";
const run = (patch: Partial<RunSnapshot> = {}): RunSnapshot => ({ type: "video_ads", status: "running", cost_credits: 40, creatives: [], ...patch });
test("video stages follow the earliest unfinished durable job, never time elapsed", () => {
  assert.equal(generationPresentation(run({ status: "queued" })).phase, "queued");
  assert.equal(generationPresentation(run()).phase, "preparing");
  assert.equal(generationPresentation(run({ video_jobs: [{status:"pending"},{status:"drafting"}] })).phase, "preparing");
  assert.equal(generationPresentation(run({ video_jobs: [{status:"processing"},{status:"pending"}] })).phase, "creating");
  assert.equal(generationPresentation(run({ video_jobs: [{status:"done"},{status:"processing"}] })).phase, "finishing");
});
test("saved ads remain counted while a run is active or partially complete", () => {
  const creatives = [{kind:"video" as const}];
  assert.deepEqual(generationPresentation(run({creatives})), {video:true,total:2,saved:1,active:true,phase:"preparing"});
  assert.equal(generationPresentation(run({status:"succeeded",creatives})).phase,"partial");
  assert.equal(generationPresentation(run({status:"succeeded",creatives:[...creatives,...creatives]})).phase,"ready");
  assert.equal(generationPresentation(run({status:"failed",creatives})).phase,"failed");
});
test("images report saved files rather than inventing a percentage", () => {
  const creatives = Array.from({length:10},()=>({kind:"image" as const}));
  assert.equal(generationPresentation(run({type:"image_ads",creatives:creatives.slice(0,3)})).phase,"creating");
  assert.equal(generationPresentation(run({type:"image_ads",creatives})).phase,"finishing");
});
test("refunds use receipts, not output-count arithmetic or error text", () => {
  const g=run({status:"succeeded",creatives:[{kind:"video"}]});
  assert.equal(settledCredits(g,null),null);
  assert.equal(settledCredits(g,{charged_credits:40,returned_credits:null}),null);
  assert.deepEqual(settledCredits(g,{charged_credits:40,returned_credits:20}),{used:20,returned:20});
  assert.deepEqual(settledCredits(g,{charged_credits:null,returned_credits:20}),{used:null,returned:20});
  assert.equal(settledCredits(run(),{charged_credits:40,returned_credits:20}),null);
  for (const returned_credits of [-1,41,NaN,0.5]) assert.equal(settledCredits(g,{charged_credits:40,returned_credits}),null);
});
test("image runs expect two sizes per chosen idea, five for older runs", () => {
  const images = (n: number) => Array.from({length:n},()=>({kind:"image" as const}));
  const image = (ideas: unknown, saved: number) => generationPresentation(run({type:"image_ads",status:"succeeded",creatives:images(saved),request_options:{ideas}}));
  assert.equal(image(1, 2).total, 2);assert.equal(image(1, 2).phase, "ready");
  assert.equal(image(3, 6).phase, "ready");assert.equal(image(3, 5).phase, "partial");
  assert.equal(image(undefined, 10).total, 10);assert.equal(image(7, 10).total, 10);
});
