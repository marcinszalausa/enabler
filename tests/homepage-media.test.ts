import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
type Asset={src:string;small:string;placeholder:string};
test("homepage snapshot selection excludes the confirmed cropped ads and has ready posters",async()=>{
 const media=JSON.parse(await readFile(new URL("../src/lib/homepage-media.json",import.meta.url),"utf8"));
 for(const id of ["46d43450-4e91-4c31-a2bd-2a0be028eb70","b0a3d667-599a-4dc8-843a-ab4f4e5b37fe"])assert.equal(media.images[id],undefined);
 for(const asset of [...(Object.values(media.images) as Asset[]),...(Object.values(media.photos) as Asset[]),...(Object.values(media.posters) as Asset[])]){
  assert.ok(asset.src.startsWith("/showcase/"));assert.ok(asset.small.endsWith("-480.webp"));assert.ok(asset.placeholder.startsWith("data:image/webp;base64,"));
  for(const path of [asset.src,asset.small])assert.ok((await readFile(new URL("../public"+path,import.meta.url))).length>0);
 }
 for(const video of Object.values(media.videos) as {src:string;poster:string;bytes:number}[]){assert.ok(video.poster);assert.ok(video.bytes<1800000);assert.ok((await readFile(new URL("../public"+video.src,import.meta.url))).length===video.bytes);}
});
