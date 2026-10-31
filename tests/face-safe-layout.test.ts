import assert from "node:assert/strict";
import test from "node:test";
import {chooseOverlays,chooseCaption,protectFaces,overlaps,NO_OVERLAYS,type Rect} from "../src/lib/face-safe-layout.ts";
test("headline, button and logo avoid every padded face in many positions",()=>{
 for(const aspect of ["1:1","9:16"] as const){
  const height=aspect==="9:16"?1920:1080;
  for(const x of [0,100,420,700,900])for(const y of [0,120,400,height-400]){
   const faces=[{x,y,width:180,height:240},{x:700-x/2,y:height-y-250,width:120,height:160}];
   const plan=chooseOverlays(aspect,faces,{headline:true,cta:"Shop now",logo:true}),guard=protectFaces(faces,1080,height);
   const regions=Object.values(plan).filter((r):r is Rect=>r!==null);
   for(const r of regions)for(const f of guard)assert.equal(overlaps(r,f),false);
   for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++)assert.equal(overlaps(regions[i],regions[j]),false);
   const caption=chooseCaption(aspect,faces);if(caption)for(const face of guard)assert.equal(overlaps(caption,face),false);
  }
 }
});
test("full-face/crowded or failed analysis preserves the image without unsafe overlays",()=>{
 assert.deepEqual(chooseOverlays("9:16",null,{headline:true,cta:"Shop now",logo:true}),NO_OVERLAYS);
 assert.deepEqual(chooseOverlays("9:16",[{x:0,y:0,width:1080,height:1920}],{headline:true,cta:"Shop now",logo:true}),NO_OVERLAYS);
 assert.equal(chooseCaption("9:16",null),null);
 assert.equal(chooseCaption("9:16",[{x:0,y:0,width:1080,height:1920}]),null);
 const normal=chooseOverlays("9:16",[],{headline:true,cta:"Shop now",logo:true});assert.ok(normal.headline&&normal.cta&&normal.logo);
});
