import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandKit } from "@/lib/brand-kit";
import { FONTS, loadFont, textColorOn } from "@/lib/brand";
import { AD_SIZES, AdLayout, type AdAspect } from "@/lib/ad-layout";

// Renders the finished ad: generated photo + headline + call to action + logo.
// Text is drawn here rather than by the image model so it's always legible,
// and the brand kit is applied at render time, so older ads pick up changes.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/creatives/[id]/image">,
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  // RLS: returns the row only for members of its workspace.
  const { data: creative } = await supabase
    .from("creatives")
    .select("workspace_id, storage_path, aspect, headline, cta")
    .eq("id", id)
    .maybeSingle();
  if (!creative) return new Response("Not found", { status: 404 });

  const kit = await getBrandKit(supabase, creative.workspace_id);
  const [photo, logo, font] = await Promise.all([
    supabase.storage
      .from("creatives")
      .createSignedUrl(creative.storage_path, 300),
    kit.logo_path
      ? supabase.storage.from("creatives").createSignedUrl(kit.logo_path, 300)
      : Promise.resolve(null),
    loadFont(kit.font),
  ]);
  if (!photo.data) return new Response("Not found", { status: 404 });

  const aspect: AdAspect =
    creative.aspect in AD_SIZES ? (creative.aspect as AdAspect) : "1:1";
  const size = AD_SIZES[aspect];

  const image = new ImageResponse(
    <AdLayout
      photoUrl={photo.data.signedUrl}
      aspect={aspect}
      headline={creative.headline ?? ""}
      cta={creative.cta ?? "Shop now"}
      fontFamily={FONTS[kit.font].name}
      accentColor={kit.accent_color}
      accentTextColor={textColorOn(kit.accent_color)}
      logoUrl={logo?.data?.signedUrl ?? null}
    />,
    {
      ...size,
      fonts: [
        {
          name: FONTS[kit.font].name,
          data: font,
          weight: 700,
          style: "normal",
        },
      ],
      headers: { "cache-control": "private, max-age=3600" },
    },
  );

  if (request.nextUrl.searchParams.get("download")) {
    image.headers.set(
      "content-disposition",
      `attachment; filename="enabler-ad-${id.slice(0, 8)}-${aspect.replace(":", "x")}.png"`,
    );
  }
  return image;
}
