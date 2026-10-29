import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandBrief } from "@/lib/ai/claude";

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
  // Seconds from clicking Generate to the last ad saved.
  seconds: number | null;
  ads: ShowcaseAd[];
};

type Row = {
  id: string;
  created_at: string;
  products: {
    name: string | null;
    url: string;
    brand_brief: BrandBrief | null;
  } | null;
  creatives: {
    id: string;
    aspect: string;
    angle: string | null;
    headline: string | null;
    primary_text: string | null;
    created_at: string;
  }[];
};

// Real, unedited runs the team chose to show, oldest pick first. A product
// shown more than once keeps only its newest run, so a redo replaces it.
export async function getShowcase(): Promise<ShowcaseRun[]> {
  "use cache";
  cacheTag(SHOWCASE_TAG);
  cacheLife("hours");

  if (!process.env.SUPABASE_SECRET_KEY) return [];
  const { data } = await createAdminClient()
    .from("generations")
    .select(
      "id, created_at, products(name, url, brand_brief), creatives(id, aspect, angle, headline, primary_text, created_at)",
    )
    .not("showcased_at", "is", null)
    .eq("status", "succeeded")
    .order("showcased_at")
    .returns<Row[]>();

  // Runs come oldest first, so a later run of the same product replaces the
  // earlier one (keeping the product's place in the order).
  const newestPerProduct = new Map<string, Row>();
  for (const g of data ?? []) {
    if (g.products && g.creatives.length > 0)
      newestPerProduct.set(productKey(g.products.url), g);
  }

  return [...newestPerProduct.values()].map((g) => {
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
      seconds: seconds > 0 && seconds < 3600 ? seconds : null,
      ads: g.creatives.map((c) => ({
        id: c.id,
        aspect: c.aspect === "9:16" ? "9:16" : "1:1",
        angle: c.angle ?? "",
        headline: c.headline ?? "",
        primaryText: c.primary_text ?? "",
      })),
    };
  });
}

// Same product even if the link differs by www, query string or case.
function productKey(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${path}`;
  } catch {
    return url;
  }
}
