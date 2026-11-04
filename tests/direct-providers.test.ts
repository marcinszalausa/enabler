import test from "node:test";
import assert from "node:assert/strict";
import { GATEWAY_SEEDANCE, gatewayVideoResult, seedanceStartOptions } from "../src/lib/ai/gateway-video.ts";

test("Seedance job asks for a silent vertical clip from the first frame", () => {
  const options = seedanceStartOptions({ prompt: "A walk", imageUrl: "https://x.test/a.jpg", seconds: 4, resolution: "720p" });
  assert.equal(options.model, GATEWAY_SEEDANCE);
  assert.deepEqual(options.frameImages, [{ image: "https://x.test/a.jpg", frameType: "first_frame" }]);
  assert.equal(options.aspectRatio, "9:16");
  assert.equal(options.resolution, "1280x720");
  assert.equal(seedanceStartOptions({ prompt: "", imageUrl: "", seconds: 4, resolution: "1080p" }).resolution, "1920x1080");
  assert.equal(options.duration, 4);
  assert.equal(options.generateAudio, false);
  assert.throws(() => seedanceStartOptions({ prompt: "", imageUrl: "", seconds: 4, resolution: "4k" }), /resolution/);
});

test("Seedance job results: waiting, hosted, inline and failed", () => {
  assert.equal(gatewayVideoResult({ status: "pending" }), null);
  assert.deepEqual(gatewayVideoResult({ status: "completed", videos: [{ type: "url", url: "https://v.test/c.mp4", mediaType: "video/mp4" }] }), { url: "https://v.test/c.mp4" });
  const inline = gatewayVideoResult({ status: "completed", videos: [{ type: "base64", data: Buffer.from("mp4").toString("base64"), mediaType: "video/mp4" }] });
  assert.ok(inline && "bytes" in inline && inline.bytes.toString() === "mp4");
  assert.throws(() => gatewayVideoResult({ status: "error", error: "bad image" }), /bad image/);
  assert.throws(() => gatewayVideoResult({ status: "completed", videos: [] }), /no video/);
});

import { GOOGLE_IMAGE_MODELS, googleImageBody, googleImageResult } from "../src/lib/ai/google-image.ts";

test("Gemini image request carries the product photo, aspect and size", () => {
  const body = googleImageBody({ prompt: "Place it", image: { mimeType: "image/jpeg", data: "QUJD" }, aspect: "9:16", size: "2K" });
  assert.deepEqual(body.contents[0].parts[0], { inline_data: { mime_type: "image/jpeg", data: "QUJD" } });
  assert.deepEqual(body.contents[0].parts[1], { text: "Place it" });
  assert.deepEqual(body.generationConfig.imageConfig, { aspectRatio: "9:16", imageSize: "2K" });
  assert.equal(googleImageBody({ prompt: "Draw", image: null, aspect: "1:1", size: "1K" }).contents[0].parts.length, 1);
  assert.equal(GOOGLE_IMAGE_MODELS.best.size, "2K");
});

test("Gemini image answer: skips text parts, reports blocks", () => {
  const out = googleImageResult({ candidates: [{ content: { parts: [{}, { inlineData: { mimeType: "image/png", data: Buffer.from("png").toString("base64") } }] } }] });
  assert.equal(out.mimeType, "image/png");
  assert.equal(out.bytes.toString(), "png");
  assert.throws(() => googleImageResult({ promptFeedback: { blockReason: "SAFETY" } }), /SAFETY/);
  assert.throws(() => googleImageResult({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] }), /IMAGE_SAFETY/);
});
