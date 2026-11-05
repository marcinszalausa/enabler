import test from "node:test";
import assert from "node:assert/strict";
import { parseTikTokChoice, tiktokSettings, AUTOPILOT_TIKTOK } from "../src/lib/social/tiktok-settings.ts";

const form = (values: Record<string, string>) => ({ get: (k: string) => values[k] ?? null });

test("TikTok posts need the customer's own audience choice", () => {
  assert.deepEqual(parseTikTokChoice(form({})), { ok: false, reason: "privacy" });
  assert.deepEqual(parseTikTokChoice(form({ tiktokPrivacy: "EVERYONE" })), { ok: false, reason: "privacy" });
  const r = parseTikTokChoice(form({ tiktokPrivacy: "FOLLOWER_OF_CREATOR" }));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.choice.allowComment, false);
    assert.equal(r.choice.allowDuet, false);
    assert.equal(r.choice.commercial, "none");
    assert.equal(r.choice.aiLabel, false);
  }
});

test("promotion disclosure and AI label map to TikTok settings", () => {
  const r = parseTikTokChoice(form({ tiktokPrivacy: "PUBLIC_TO_EVERYONE", tiktokPromo: "on", tiktokCommercial: "brand_organic", tiktokAiLabel: "on", tiktokDuet: "on" }));
  assert.ok(r.ok);
  if (!r.ok) return;
  const video = tiktokSettings(r.choice, "video");
  assert.equal(video.commercialContentType, "brand_organic");
  assert.equal(video.videoMadeWithAi, true);
  assert.equal(video.allow_duet, true);
  const photo = tiktokSettings(r.choice, "image");
  assert.equal("videoMadeWithAi" in photo, false);
  assert.equal(photo.allow_duet, false);
  assert.deepEqual(parseTikTokChoice(form({ tiktokPrivacy: "SELF_ONLY", tiktokPromo: "on", tiktokCommercial: "brand_content" })), { ok: false, reason: "brandedPrivate" });
  const auto = tiktokSettings(AUTOPILOT_TIKTOK, "video");
  assert.equal(auto.allow_comment, false);
  assert.equal(auto.commercialContentType, "brand_organic");
  assert.equal(auto.videoMadeWithAi, true);
});
