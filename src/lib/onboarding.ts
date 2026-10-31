export type AdKind = "image" | "video";
export function adKind(value: unknown): AdKind { return value === "video" ? "video" : "image"; }
export function productLink(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;
  try {
    const text = value.trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : "https://" + text);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(value)) return "/dashboard";
  try {
    const u = new URL(value, "https://gooidy.invalid");
    if (u.origin !== "https://gooidy.invalid" || u.pathname === "/login") return "/dashboard";
    return u.pathname + u.search + u.hash;
  } catch { return "/dashboard"; }
}
export function setupPath(url: string, kind: AdKind): string {
  return "/dashboard/setup?" + new URLSearchParams({ url, kind }).toString();
}
export function setupContext(next: string | null | undefined): { url: string; kind: AdKind } | null {
  const u = new URL(safeNextPath(next), "https://gooidy.invalid");
  const url = productLink(u.searchParams.get("url"));
  return u.pathname === "/dashboard/setup" && url ? { url, kind: adKind(u.searchParams.get("kind")) } : null;
}
