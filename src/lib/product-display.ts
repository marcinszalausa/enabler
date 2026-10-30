// Shared identity for image/video runs and all public showcase layouts.
export function productKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^.*(\/products\/[^/]+).*$/, "$1").replace(/\/+$/, "").toLowerCase();
    return u.hostname.replace(/^www\./, "").toLowerCase() + path;
  } catch { return url.trim().toLowerCase(); }
}

export type ProductDisplay = { productKey: string };
export function distinctProducts<T extends ProductDisplay>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item.productKey || seen.has(item.productKey)) return false;
    seen.add(item.productKey);
    return true;
  });
}

// Side products are reserved for the whole middle playlist, including the
// last-to-first transition. Independent video endings cannot create a collision.
export function heroProducts<T extends ProductDisplay>(items: readonly T[]): {
  feed: T[]; left?: T; right?: T;
} {
  const products = distinctProducts(items);
  const left = products[1];
  const right = products[2];
  const reserved = new Set([left?.productKey, right?.productKey]);
  return {
    feed: items.filter(item => item.productKey && !reserved.has(item.productKey)).slice(0, 6),
    left, right,
  };
}
