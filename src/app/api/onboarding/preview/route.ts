import { NextResponse } from "next/server";
import { scrapePage } from "@/lib/scrape";
import { fetchPublicUrl } from "@/lib/public-fetch";
import { productLink } from "@/lib/onboarding";
import { PreviewBudget } from "@/lib/onboarding-preview-limit";
export const maxDuration = 60;
const budget = new PreviewBudget();
const cache = new Map<string, { at: number; value: { url: string; title: string; photo: string | null } }>();
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let text = "", size = 0;
  try {
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4096) { await reader.cancel(); return new Response(null, { status: 413 }); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } catch { return new Response(null, { status: 400 }); }
  finally { reader.releaseLock(); }
  let url: string | null;
  try { url = productLink(JSON.parse(text).url); } catch { return new Response(null, { status: 400 }); }
  if (!url) return new Response(null, { status: 400 });
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  if (!budget.take(ip.slice(0, 128))) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  const prior = cache.get(url);
  if (prior && Date.now() - prior.at < 300000) return NextResponse.json(prior.value, { headers: { "Cache-Control": "no-store" } });
  try {
    // Metadata only, using the existing pinned-DNS downloader. No accounts,
    // database writes or paid models. Photos are resized here, never hotlinked.
    const page = await scrapePage(url);
    let photo: string | null = null;
    if (page.imageUrls[0]) try {
      const response = await fetchPublicUrl(page.imageUrls[0], { maxBytes: 3000000, timeoutMs: 8000, accept: "image/*" });
      if (response.status >= 200 && response.status < 300) {
        const { default: sharp } = await import("sharp");
        const bytes = await sharp(response.body, { limitInputPixels: 20000000 }).rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
        photo = "data:image/webp;base64," + bytes.toString("base64");
      }
    } catch { /* Keep the title/link when a store blocks its photo. */ }
    const value = { url: page.url, title: (page.title ?? new URL(page.url).hostname).slice(0, 180), photo };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(url, { at: Date.now(), value });
    return NextResponse.json(value, { headers: { "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 422 }); }
}
