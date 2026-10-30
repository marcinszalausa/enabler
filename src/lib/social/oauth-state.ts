import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SOCIAL_CONNECT_TTL = 600;
export const SOCIAL_STATE_PARAM = "gooidy_state";
const noncePattern = /^[A-Za-z0-9_-]{43}$/;

export type SocialConnectContext = {
  workspace_id: string;
  profile_id: string;
  platform: string;
};

export function newSocialConnectNonce() {
  return randomBytes(32).toString("base64url");
}

export function hashSocialConnectNonce(nonce: string) {
  if (!noncePattern.test(nonce)) throw new Error("Invalid connection nonce");
  return createHash("sha256").update(nonce).digest("hex");
}

export function socialConnectCookie(production: boolean) {
  return {
    name: production ? "__Host-gooidy-social-state" : "gooidy-social-state",
    options: { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/", maxAge: SOCIAL_CONNECT_TTL },
  };
}

export function callbackUrlForOrigin(
  origin: string,
  nonce: string,
  production: boolean,
  vercelHosts: (string | undefined)[] = [],
) {
  hashSocialConnectNonce(nonce);
  const url = new URL(origin);
  const allowed = new Set(["https://gooidy.com", "https://www.gooidy.com"]);
  for (const host of vercelHosts) {
    if (host && /^[a-z0-9.-]+\.vercel\.app$/i.test(host)) allowed.add("https://" + host.toLowerCase());
  }
  if (!production && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    && ["http:", "https:"].includes(url.protocol)) allowed.add(url.origin);
  if (url.username || url.password || !allowed.has(url.origin)) throw new Error("Untrusted callback origin");
  const callback = new URL("/api/social/callback", url.origin);
  callback.searchParams.set(SOCIAL_STATE_PARAM, nonce);
  return callback.toString();
}

export async function authorizeSocialCallback(
  params: URLSearchParams,
  cookieNonce: string | undefined,
  userId: string,
  consume: (nonceHash: string, userId: string) => Promise<SocialConnectContext | null>,
): Promise<SocialConnectContext | null> {
  const values = params.getAll(SOCIAL_STATE_PARAM);
  const nonce = values[0];
  if (values.length !== 1 || !nonce || !cookieNonce
    || !noncePattern.test(nonce) || !noncePattern.test(cookieNonce)) return null;
  if (!timingSafeEqual(Buffer.from(nonce), Buffer.from(cookieNonce))) return null;
  const context = await consume(hashSocialConnectNonce(nonce), userId);
  if (!context) return null;
  // A genuine cancellation can omit provider resource fields; it performs no
  // mutation but still consumes its matching connection attempt.
  if (params.has("error")) return context;
  if (params.getAll("profileId").length !== 1 || params.get("profileId") !== context.profile_id
    || params.getAll("connected").length !== 1 || params.get("connected") !== context.platform) return null;
  return context;
}
