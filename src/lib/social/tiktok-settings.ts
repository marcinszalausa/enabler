// TikTok's Content Posting rules: the customer picks who can see the post and
// which interactions are on (nothing preselected), discloses promotional
// content, and labels AI-generated video. This turns those choices into the
// settings Zernio forwards to TikTok.

export const TIKTOK_PRIVACY = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
] as const;
export type TikTokPrivacy = (typeof TIKTOK_PRIVACY)[number];

export const TIKTOK_COMMERCIAL = ["none", "brand_organic", "brand_content"] as const;
export type TikTokCommercial = (typeof TIKTOK_COMMERCIAL)[number];

export type TikTokChoice = {
  privacy: TikTokPrivacy;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  commercial: TikTokCommercial;
  aiLabel: boolean;
};

export type TikTokParse =
  | { ok: true; choice: TikTokChoice }
  | { ok: false; reason: "privacy" | "brandedPrivate" };

type Form = { get(name: string): unknown };

export function parseTikTokChoice(form: Form): TikTokParse {
  const privacy = form.get("tiktokPrivacy");
  if (!(TIKTOK_PRIVACY as readonly unknown[]).includes(privacy)) {
    return { ok: false, reason: "privacy" };
  }
  const promo = form.get("tiktokPromo") === "on";
  const kind = form.get("tiktokCommercial");
  const commercial: TikTokCommercial = !promo
    ? "none"
    : kind === "brand_content"
      ? "brand_content"
      : "brand_organic";
  // TikTok rejects branded content that only the creator can see.
  if (commercial === "brand_content" && privacy === "SELF_ONLY") {
    return { ok: false, reason: "brandedPrivate" };
  }
  return {
    ok: true,
    choice: {
      privacy: privacy as TikTokPrivacy,
      allowComment: form.get("tiktokComment") === "on",
      allowDuet: form.get("tiktokDuet") === "on",
      allowStitch: form.get("tiktokStitch") === "on",
      commercial,
      aiLabel: form.get("tiktokAiLabel") === "on",
    },
  };
}

// Autopilot posts without a dialog, so TikTok gets each ad as a draft in the
// creator's TikTok inbox: the customer picks audience and settings and posts
// it in the TikTok app, as TikTok's posting rules expect.
export const AUTOPILOT_TIKTOK = "draft" as const;
export type TikTokPost = TikTokChoice | typeof AUTOPILOT_TIKTOK;

export function tiktokSettings(choice: TikTokPost, kind: "image" | "video"): Record<string, unknown> {
  const video = kind === "video";
  if (choice === AUTOPILOT_TIKTOK) {
    return {
      draft: true,
      commercialContentType: "brand_organic",
      ...(video ? { videoMadeWithAi: true } : {}),
    };
  }
  return {
    privacy_level: choice.privacy,
    allow_comment: choice.allowComment,
    // Duet and stitch exist only for video.
    allow_duet: video && choice.allowDuet,
    allow_stitch: video && choice.allowStitch,
    commercialContentType: choice.commercial,
    // TikTok rejects the AI flag on direct photo posts, so it is sent for
    // video only; images carry it in their file metadata instead.
    ...(video && choice.aiLabel ? { videoMadeWithAi: true } : {}),
    content_preview_confirmed: true,
    express_consent_given: true,
  };
}
