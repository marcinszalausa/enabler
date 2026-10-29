import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePublicUrl, type ScrapedPage } from "@/lib/scrape";
import {
  DEFAULT_BRAND_KIT,
  LOGO_TYPES,
  MAX_LOGO_BYTES,
  isFontKey,
  isHexColor,
  type BrandKit,
} from "@/lib/brand";

export async function getBrandKit(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<BrandKit> {
  const { data } = await supabase
    .from("brand_kits")
    .select("logo_path, accent_color, font")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data) return DEFAULT_BRAND_KIT;
  return {
    logo_path: data.logo_path,
    accent_color: isHexColor(data.accent_color)
      ? data.accent_color
      : DEFAULT_BRAND_KIT.accent_color,
    font: isFontKey(data.font) ? data.font : DEFAULT_BRAND_KIT.font,
  };
}

// Stores a logo under <workspace>/brand/ and returns its storage path.
export async function storeLogo(
  workspaceId: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const ext = contentType === "image/png" ? "png" : "jpg";
  // A new name per upload, so cached ad images never show a stale logo.
  const path = `${workspaceId}/brand/logo-${Date.now()}.${ext}`;
  const { error } = await createAdminClient()
    .storage.from("creatives")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

async function downloadLogo(
  rawUrl: string,
): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const url = parsePublicUrl(rawUrl);
  // Ask for PNG/JPEG: Shopify's and Next's image CDNs otherwise send WebP,
  // which the ad renderer can't draw.
  const res = await fetch(url, {
    headers: { accept: "image/png,image/jpeg;q=0.9" },
    signal: AbortSignal.timeout(10_000),
  });
  const type = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!res.ok || !(LOGO_TYPES as readonly string[]).includes(type)) return null;
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_LOGO_BYTES) return null;
  return { bytes, type };
}

// First product added: start the brand kit from what the site shows.
// Never overwrites a kit the user already has. Failures are ignored.
export async function seedBrandKit(workspaceId: string, page: ScrapedPage) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("brand_kits")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (existing) return;

  let logoPath: string | null = null;
  if (page.logoUrl) {
    try {
      const logo = await downloadLogo(page.logoUrl);
      if (logo) logoPath = await storeLogo(workspaceId, logo.bytes, logo.type);
    } catch (err) {
      console.error("logo download failed", page.logoUrl, err);
    }
  }

  await admin.from("brand_kits").insert({
    workspace_id: workspaceId,
    logo_path: logoPath,
    accent_color: page.themeColor ?? DEFAULT_BRAND_KIT.accent_color,
  });
}
