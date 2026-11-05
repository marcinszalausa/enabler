import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { markPngAsAi, AI_SOURCE_TYPE } from "../src/lib/ai-disclosure.ts";

test("ad PNGs carry IPTC trainedAlgorithmicMedia XMP and stay valid", async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#4f46e5" } }).png().toBuffer();
  const marked = markPngAsAi(png);
  const meta = await sharp(marked).metadata();
  assert.equal(meta.width, 8);
  assert.ok(meta.xmp?.toString("utf8").includes(AI_SOURCE_TYPE));
  // Decodes to the same pixels.
  assert.deepEqual(await sharp(marked).raw().toBuffer(), await sharp(png).raw().toBuffer());
  // Idempotent, and non-PNG input is untouched.
  assert.equal(markPngAsAi(marked).length, marked.length);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  assert.deepEqual(markPngAsAi(jpeg), jpeg);
});
