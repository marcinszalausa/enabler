// The networks customers can connect, in the order the app lists them.
// Zernio's platform keys; "image"/"video" say which ads each one takes.
export const PLATFORMS = [
  { key: "instagram", name: "Instagram", image: true, video: true },
  { key: "facebook", name: "Facebook", image: true, video: true },
  { key: "tiktok", name: "TikTok", image: true, video: true },
  { key: "youtube", name: "YouTube Shorts", image: false, video: true },
  { key: "linkedin", name: "LinkedIn", image: true, video: true },
  { key: "twitter", name: "X", image: true, video: true },
  { key: "pinterest", name: "Pinterest", image: true, video: true },
  { key: "threads", name: "Threads", image: true, video: true },
  { key: "bluesky", name: "Bluesky", image: true, video: true },
  { key: "googlebusiness", name: "Google Business", image: true, video: false },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];

export function isPlatformKey(value: unknown): value is PlatformKey {
  return PLATFORMS.some((p) => p.key === value);
}

export function platformName(key: string) {
  return PLATFORMS.find((p) => p.key === key)?.name ?? key;
}

export function takesKind(key: string, kind: "image" | "video") {
  const p = PLATFORMS.find((p) => p.key === key);
  return p ? p[kind] : false;
}

// Longest caption each network accepts, where it is short.
export const CAPTION_LIMITS: Record<string, number> = {
  twitter: 280,
  bluesky: 300,
  threads: 500,
  pinterest: 500,
  googlebusiness: 1500,
};
