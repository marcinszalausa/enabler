import test from "node:test";
import assert from "node:assert/strict";
import { SEEDANCE_MODEL_ID, seedanceTaskBody, seedanceTaskResult } from "../src/lib/ai/byteplus.ts";

test("Seedance task asks for a silent vertical clip from the first frame", () => {
  const body = seedanceTaskBody({ prompt: "A walk", imageUrl: "https://x.test/a.jpg", seconds: 4, resolution: "720p" });
  assert.equal(body.model, SEEDANCE_MODEL_ID);
  assert.deepEqual(body.content[1], { type: "image_url", image_url: { url: "https://x.test/a.jpg" }, role: "first_frame" });
  assert.equal(body.ratio, "9:16");
  assert.equal(body.duration, 4);
  assert.equal(body.generate_audio, false);
  assert.equal(body.watermark, false);
});

test("Seedance task results: waiting, done and failed", () => {
  assert.equal(seedanceTaskResult({ status: "queued" }), null);
  assert.equal(seedanceTaskResult({ status: "running" }), null);
  assert.equal(seedanceTaskResult({ status: "succeeded", content: { video_url: "https://v.test/c.mp4" } }), "https://v.test/c.mp4");
  assert.throws(() => seedanceTaskResult({ status: "failed", error: { message: "bad image" } }), /bad image/);
  assert.throws(() => seedanceTaskResult({ status: "expired" }), /expired/);
  assert.throws(() => seedanceTaskResult({ status: "succeeded", content: {} }), /no video/);
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
