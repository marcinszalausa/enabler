// Adds UTM tags to the product link in a post, so the store's own analytics
// (Shopify, Google Analytics) show which visits came from Gooidy posts and on
// which network. Links that already carry UTM tags are left as they are.
export function trackedLink(url: string, platform: string, creativeId: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!/^https?:$/.test(parsed.protocol)) return url;
  if ([...parsed.searchParams.keys()].some((k) => k.startsWith("utm_"))) return url;
  parsed.searchParams.set("utm_source", platform);
  parsed.searchParams.set("utm_medium", "social");
  parsed.searchParams.set("utm_campaign", "gooidy");
  parsed.searchParams.set("utm_content", creativeId);
  return parsed.toString();
}
