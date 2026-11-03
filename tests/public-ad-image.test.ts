import test from "node:test";
import assert from "node:assert/strict";
import {publicAdPreview,publicAdRetry} from "../src/lib/public-ad-image.ts";
const source="/api/creatives/b0a3d667-599a-4dc8-843a-ab4f4e5b37fe/image";
test("public ads request bounded previews and use a stable cache key",()=>{
 const preview=source+"?layout=face-aware-v2&preview=1";
 for(const input of [source,source+"?layout=face-aware-v2",source+"?preview=1&layout=face-aware-v2"])
  assert.equal(publicAdPreview(input),preview);
 assert.equal(publicAdPreview(preview),preview);
 assert.equal(publicAdRetry(preview,1),preview+"&retry=1");
 assert.equal(publicAdRetry(preview,2),preview+"&retry=2");
});
test("exports, external photos and unrelated paths retain their original request",()=>{
 for(const src of [source+"?download=1",source+"?preview=1&download=","/reels/softmila-cardigan.jpg","https://store.com/photo.jpg","//store.com/photo.jpg","/api/creatives/invalid/image"]){
  assert.equal(publicAdPreview(src),src);
  assert.equal(publicAdRetry(src,1),src);
 }
});
