import assert from "node:assert/strict";
import test from "node:test";
import {brandDnaOff,parseFocus,parseVariations,publishedByDefault,variationRunCost,isRatio,sizeLabel} from "../src/lib/create-options.ts";
import {generationPresentation} from "../src/lib/generation-presentation.ts";
import {chooseOverlays} from "../src/lib/face-safe-layout.ts";

test("variations, focus and ratio parse only known values",()=>{
 assert.equal(parseVariations("3"),3);assert.equal(parseVariations("6"),null);assert.equal(parseVariations(null),null);assert.equal(parseVariations(""),null);
 assert.equal(parseFocus("audience"),"audience");assert.equal(parseFocus("nope"),"text");
 assert.ok(isRatio("4:5"));assert.ok(isRatio("2:3"));assert.ok(!isRatio("16:9"));
 assert.equal(variationRunCost("best",5),25);assert.equal(variationRunCost("good",1),2);
});
test("Brand DNA off is read from a run or a creative's embedded run",()=>{
 assert.equal(brandDnaOff({brand_dna:false}),true);
 assert.equal(brandDnaOff({request_options:{brand_dna:false}}),true);
 assert.equal(brandDnaOff([{request_options:{brand_dna:false}}]),true);
 assert.equal(brandDnaOff({request_options:{quality:"best"}}),false);
 assert.equal(brandDnaOff(null),false);
});
test("publishing defaults: squares from two-size runs, every image from one-size runs",()=>{
 const two=[{kind:"image",aspect:"1:1"},{kind:"image",aspect:"9:16"}];
 assert.deepEqual(two.filter(publishedByDefault).map(c=>c.aspect),["1:1"]);
 const story=[{kind:"image",aspect:"9:16"},{kind:"image",aspect:"9:16"}];
 assert.equal(story.filter(publishedByDefault).length,2);
 const portrait=[{kind:"image",aspect:"4:5"},{kind:"video",aspect:"9:16"}];
 assert.equal(portrait.filter(publishedByDefault).length,2);
});
test("a variations run expects one ad per variation",()=>{
 const p=generationPresentation({type:"image_ads",status:"running",cost_credits:15,creatives:[{kind:"image"}],request_options:{variations:3,ratio:"4:5"}});
 assert.equal(p.total,3);
 assert.equal(generationPresentation({type:"image_ads",status:"running",cost_credits:50,creatives:[]}).total,10);
});
test("new sizes lay out copy inside their own frame",()=>{
 for(const [aspect,height] of [["4:5",1350],["2:3",1620]] as const){
  const plan=chooseOverlays(aspect,[],{headline:true,cta:"Shop now",logo:true});
  assert.ok(plan.headline&&plan.cta);
  for(const r of [plan.headline!,plan.cta!])assert.ok(r.y>=0&&r.y+r.height<=height,aspect);
 }
 assert.equal(sizeLabel("4:5",{feedSize:"Feed",storySize:"Story"}),"Feed · 4:5");
 assert.equal(sizeLabel("9:16",{feedSize:"Feed",storySize:"Story"}),"Story");
});
