import "server-only";
import { productKey } from "@/lib/product-display";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandBrief } from "@/lib/ai/claude";
import { QUALITIES, parseQuality, type Quality } from "@/lib/quality";

export const SHOWCASE_TAG = "showcase";

// Team members allowed to put ad runs on the public site. Comma-separated
// emails in SHOWCASE_ADMIN_EMAILS; nobody when unset.
export function isShowcaseAdmin(email: string) {
  const admins = (process.env.SHOWCASE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return email !== "" && admins.includes(email.toLowerCase());
}

export type ShowcaseAd = {
  id: string;
  aspect: "1:1" | "9:16";
  angle: string;
  headline: string;
  primaryText: string;
};

export type ShowcaseRun = {
  id: string;
  productName: string;
  productUrl: string;
  store: string;
  summary: string;
  audience: string;
  // The product photo from the store page that the ads were made from.
  productImage: string | null;
  // Seconds from clicking Generate to the last ad saved.
  seconds: number | null;
  // The quality tier the run was made at; runs from before tiers were
  // made with today's Good models.
  quality: Quality;
  ads: ShowcaseAd[];
};

type Row = {
  id: string;
  created_at: string;
  request_options: { quality?: unknown } | null;
  products: {
    name: string | null;
    url: string;
    image_urls: string[] | null;
    brand_brief: BrandBrief | null;
  } | null;
  creatives: {
    id: string;
    kind: string;
    aspect: string;
    angle: string | null;
    headline: string | null;
    primary_text: string | null;
    created_at: string;
  }[];
};

// Real, unedited runs the team chose to show, oldest pick first. A product
// shown more than once keeps one run: its highest tier, newest within it.
// Image runs by default; video runs only appear in the home page phones.
export async function getShowcase(
  type: "image_ads" | "video_ads" = "image_ads",
): Promise<ShowcaseRun[]> {
  const runs = await getAllShowcased(type);
  const rank = (q: Quality) => QUALITIES.indexOf(q);
  const bestPerProduct = new Map<string, ShowcaseRun>();
  for (const run of runs) {
    const key = productKey(run.productUrl);
    const kept = bestPerProduct.get(key);
    if (!kept || rank(run.quality) >= rank(kept.quality)) bestPerProduct.set(key, run);
  }
  return [...bestPerProduct.values()];
}

// One showcased run per quality tier, for showing the difference: the same
// product at every tier when the team showcased one, else the newest run of
// each tier. A tier with no showcased run is null.
export async function getTierExamples(
  type: "image_ads" | "video_ads" = "image_ads",
): Promise<Record<Quality, ShowcaseRun | null>> {
  const runs = await getAllShowcased(type);
  const byProduct = new Map<string, Map<Quality, ShowcaseRun>>();
  for (const run of runs) {
    const key = productKey(run.productUrl);
    const tiers = byProduct.get(key) ?? new Map<Quality, ShowcaseRun>();
    tiers.set(run.quality, run);
    byProduct.set(key, tiers);
  }
  const fullest = [...byProduct.values()].sort((a, b) => b.size - a.size)[0];
  const newest = (q: Quality) => [...runs].reverse().find((r) => r.quality === q) ?? null;
  return Object.fromEntries(
    QUALITIES.map((q) => [q, fullest?.get(q) ?? newest(q)]),
  ) as Record<Quality, ShowcaseRun | null>;
}

// Every showcased run of a type, oldest pick first.
async function getAllShowcased(type: "image_ads" | "video_ads"): Promise<ShowcaseRun[]> {
  "use cache";
  cacheTag(SHOWCASE_TAG);
  cacheLife("hours");

  if (!process.env.SUPABASE_SECRET_KEY) return [];
  const { data } = await createAdminClient()
    .from("generations")
    .select(
      "id, created_at, request_options, products(name, url, image_urls, brand_brief), creatives(id, kind, aspect, angle, headline, primary_text, created_at)",
    )
    .not("showcased_at", "is", null)
    .eq("status", "succeeded")
    .eq("type", type)
    .order("showcased_at")
    .returns<Row[]>();
  const kind = type === "video_ads" ? "video" : "image";
  return (data ?? []).flatMap((g) => {
    g.creatives = g.creatives.filter((c) => c.kind === kind);
    return g.products && g.creatives.length > 0 ? [toRun(g)] : [];
  });
}

function toRun(g: Row): ShowcaseRun {
  {
    const product = g.products!;
    const lastSaved = Math.max(
      ...g.creatives.map((c) => Date.parse(c.created_at)),
    );
    const seconds = Math.round((lastSaved - Date.parse(g.created_at)) / 1000);
    return {
      id: g.id,
      productName: product.brand_brief?.product_name ?? product.name ?? "",
      productUrl: product.url,
      store: new URL(product.url).hostname.replace(/^www\./, ""),
      summary: product.brand_brief?.summary ?? "",
      audience: product.brand_brief?.audience ?? "",
      productImage: product.image_urls?.[0] ?? null,
      seconds: seconds > 0 && seconds < 3600 ? seconds : null,
      quality: parseQuality(g.request_options?.quality, "good"),
      ads: g.creatives.map((c) => ({
        id: c.id,
        aspect: c.aspect === "9:16" ? "9:16" : "1:1",
        angle: c.angle ?? "",
        headline: c.headline ?? "",
        primaryText: c.primary_text ?? "",
      })),
    };
  }
}

