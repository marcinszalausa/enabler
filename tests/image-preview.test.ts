import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { wantsImagePreview,makeImagePreview } from "../src/lib/image-preview.ts";

test("explicit exports and default image requests retain the full-resolution path",()=>{
  for(const query of ["","v=updated","download=1","preview=0","preview=1&download=1","preview=1&download="])
    assert.equal(wantsImagePreview(new URLSearchParams(query)),false,query);
  assert.equal(wantsImagePreview(new URLSearchParams("preview=1&v=updated")),true);
});
test("portrait and square previews keep aspect ratio and cache privacy",async()=>{
  for(const [width,height] of [[1080,1920],[1080,1080],[320,320]]){
    const source=await sharp({create:{width,height,channels:3,background:"#8164c5"}}).png().toBuffer();
    const response=await makeImagePreview(new Response(new Uint8Array(source),{headers:{"content-type":"image/png","cache-control":"private, max-age=3600","content-length":String(source.length)}}));
    assert.equal(response.headers.get("content-type"),"image/webp");
    assert.equal(response.headers.get("cache-control"),"private, max-age=3600");
    assert.equal(response.headers.has("content-length"),false);
    const output=await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    const target=Math.min(width,640);
    assert.equal(output.width,target);
    assert.equal(output.height,Math.round(height*target/width));
  }
});
test("photographic previews transfer substantially less data without changing the source export",async()=>{
  const photograph=await readFile(new URL("../public/reels/softmila-cardigan.jpg",import.meta.url));
  const full=await sharp(photograph).resize(1080,1920,{fit:"cover"}).png().toBuffer();
  const original=Buffer.from(full);
  const response=await makeImagePreview(new Response(new Uint8Array(full),{headers:{"cache-control":"public, max-age=3600"}}));
  const preview=Buffer.from(await response.arrayBuffer());
  assert.ok(preview.length<full.length*0.5);
  assert.deepEqual(full,original);
  assert.equal(response.headers.get("cache-control"),"public, max-age=3600");
  console.log("DASHBOARD_PREVIEW_BYTES",JSON.stringify({original:full.length,preview:preview.length}));
});

test("preview processing failures preserve the original response and private cache headers",async(t)=>{
  t.mock.method(console,"error",()=>{});
  const source=new Uint8Array([1,2,3]);
  const response=await makeImagePreview(new Response(source,{headers:{"content-type":"image/png","cache-control":"private, max-age=3600"}}));
  assert.equal(response.headers.get("content-type"),"image/png");
  assert.equal(response.headers.get("cache-control"),"private, max-age=3600");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),source);
});
