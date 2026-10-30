import "server-only";
import { UserError } from "@/lib/errors";
import { fetchPublicUrl, parsePublicHttpUrl, verifyPublicUrl } from "@/lib/public-fetch";

export type ScrapedPage = {
  url: string;
  title: string | null;
  description: string | null;
  price: string | null;
  imageUrls: string[];
  text: string;
  // Brand hints for the brand kit; best effort.
  themeColor: string | null;
  logoUrl: string | null;
};

const MAX_HTML_BYTES = 2_000_000;
const MAX_TEXT_CHARS = 12_000;

// Syntax/address checks here; every actual request also resolves and pins DNS.
export function parsePublicUrl(raw: string): URL {
  try { return parsePublicHttpUrl(raw); }
  catch { throw new UserError("That address isn't a supported public website."); }
}

async function fetchText(url: URL, accept: string) {
  const response = await fetchPublicUrl(url, { maxBytes: MAX_HTML_BYTES, accept, timeoutMs: 15000 });
  if (response.status < 200 || response.status >= 300) return null;
  return { text: response.body.toString("utf8"), url: response.url };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function meta(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  const value = m?.[1] ?? m?.[2];
  return value ? decodeEntities(value).trim() : null;
}

type JsonLdProduct = {
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string }[];
  offers?:
    | { price?: string | number; priceCurrency?: string }
    | { price?: string | number; priceCurrency?: string }[];
};

function findJsonLdProduct(html: string): JsonLdProduct | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, body] of blocks) {
    try {
      const data = JSON.parse(body);
      const nodes: unknown[] = Array.isArray(data)
        ? data
        : (data?.["@graph"] ?? [data]);
      for (const node of nodes) {
        const n = node as { "@type"?: string | string[] };
        const types = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]];
        if (types.includes("Product")) return node as JsonLdProduct;
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }
  return null;
}

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function absolutize(src: string, base: URL): string | null {
  try {
    const u = new URL(src.startsWith("//") ? `https:${src}` : src, base);
    return parsePublicHttpUrl(u).toString();
  } catch {
    return null;
  }
}

function findLogo(html: string, base: URL): string | null {
  // 1. JSON-LD Organization logo.
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, body] of blocks) {
    const m = body.match(
      /"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*"url"\s*:\s*"([^"]+)")/,
    );
    const src = m?.[1] ?? m?.[2];
    if (src) return absolutize(src, base);
  }
  // 2. An <img> whose class, id or alt mentions "logo" (typical store header).
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/(class|id|alt)=["'][^"']*logo/i.test(tag)) continue;
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (src && !src.startsWith("data:"))
      return absolutize(decodeEntities(src), base);
  }
  // 3. Apple touch icon: square, usually high resolution.
  const icon = html.match(
    /<link[^>]+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
  )?.[1];
  return icon ? absolutize(icon, base) : null;
}

// Shopify exposes clean product data at /products/<handle>.json.
async function tryShopify(url: URL): Promise<Partial<ScrapedPage> | null> {
  if (!/\/products\/[^/]+/.test(url.pathname)) return null;
  const jsonUrl = new URL(url);
  jsonUrl.pathname = url.pathname.replace(/\/$/, "") + ".json";
  jsonUrl.search = "";
  const body = await fetchText(jsonUrl, "application/json").catch(() => null);
  if (!body) return null;
  try {
    const { product } = JSON.parse(body.text) as {
      product?: {
        title?: string;
        body_html?: string;
        images?: { src?: string }[];
        variants?: { price?: string }[];
      };
    };
    if (!product?.title) return null;
    return {
      title: product.title,
      description: product.body_html ? visibleText(product.body_html) : null,
      price: product.variants?.[0]?.price ?? null,
      imageUrls: (product.images ?? []).flatMap((i) => (i.src ? [i.src] : [])),
    };
  } catch {
    return null;
  }
}

export async function scrapePage(rawUrl: string): Promise<ScrapedPage> {
  const requestedUrl = parsePublicUrl(rawUrl);
  const response = await fetchText(requestedUrl, "text/html,application/xhtml+xml").catch(() => null);
  if (!response) {
    throw new UserError(
      "We couldn't open that page. Check the link and try again.",
    );
  }

  const { text: html, url } = response;
  const product = findJsonLdProduct(html);
  const shopify = await tryShopify(url);

  const offers = Array.isArray(product?.offers)
    ? product?.offers[0]
    : product?.offers;
  const ldImages = !product?.image
    ? []
    : typeof product.image === "string"
      ? [product.image]
      : product.image.flatMap((i) =>
          typeof i === "string" ? [i] : i.url ? [i.url] : [],
        );

  const images = [
    ...(shopify?.imageUrls ?? []),
    ...ldImages,
    meta(html, "og:image"),
    meta(html, "twitter:image"),
  ]
    .flatMap((src) => (src ? [absolutize(src, url)] : []))
    .filter((u): u is string => Boolean(u));

  // Validate extracted URLs as well, including URLs in Shopify/JSON-LD data.
  // Cache only within this parse; every later download/provider handoff checks again.
  const checks = new Map<string, Promise<boolean>>();
  const validate = async (raw: string | null): Promise<string | null> => {
    if (!raw) return null;
    try {
      const candidate = parsePublicHttpUrl(raw);
      let check = checks.get(candidate.hostname);
      if (!check) {
        check = verifyPublicUrl(candidate).then(() => true, () => false);
        checks.set(candidate.hostname, check);
      }
      return await check ? candidate.toString() : null;
    } catch { return null; }
  };
  const [safeImages, logoUrl] = await Promise.all([
    Promise.all([...new Set(images)].slice(0,8).map(validate)),
    validate(findLogo(html,url)),
  ]);

  return {
    url: url.toString(),
    title:
      shopify?.title ??
      product?.name ??
      meta(html, "og:title") ??
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
      null,
    description:
      shopify?.description ??
      product?.description ??
      meta(html, "og:description") ??
      meta(html, "description"),
    price:
      shopify?.price ??
      (offers?.price != null
        ? `${offers.price}${offers.priceCurrency ? ` ${offers.priceCurrency}` : ""}`
        : null),
    imageUrls: safeImages.filter((value): value is string => value !== null),
    text: visibleText(html),
    themeColor: (() => {
      const c = meta(html, "theme-color");
      return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null;
    })(),
    logoUrl,
  };
}
