import "server-only";
import sharp from "sharp";
import {detectFaces} from "@/lib/face-detection";
import {chooseOverlays,FACE_SAFE_LAYOUT_VERSION} from "@/lib/face-safe-layout";
import { ImageResponse } from "next/og";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrandKit } from "@/lib/brand-kit";
import { FONTS, loadFont, textColorOn } from "@/lib/brand";
import {
  AD_SIZES,
  AdLayout,
  adTextStyles,
  type AdAspect,
} from "@/lib/ad-layout";
import { fontsFor, isRtl, prepareText, measureCopyWidth } from "@/lib/ad-text";

export type AdImageCreative = {
  workspace_id: string;
  storage_path: string;
  aspect: string;
  headline: string | null;
  cta: string | null;
};

// Renders the finished ad: generated photo + headline + call to action + logo.
// Text is drawn here rather than by the image model so it's always legible,
// and the brand kit is applied at render time, so older ads pick up changes.
// Returns null when the photo is gone.
export async function renderAdImage(
  supabase: SupabaseClient,
  creative: AdImageCreative,
  headers?: Record<string, string>,
) {
  const kit = await getBrandKit(supabase, creative.workspace_id);
  const [photo, logo, font] = await Promise.all([
    supabase.storage
      .from("creatives")
      .download(creative.storage_path),
    kit.logo_path
      ? supabase.storage.from("creatives").createSignedUrl(kit.logo_path, 300)
      : Promise.resolve(null),
    loadFont(kit.font),
  ]);
  if (!photo.data || photo.data.size>12*1024*1024) return null;

  const aspect: AdAspect =
    creative.aspect in AD_SIZES ? (creative.aspect as AdAspect) : "1:1";
  const size = AD_SIZES[aspect];

  // Copy in any language: extra fonts for Japanese, Korean and Chinese, and
  // Hindi or Arabic drawn as images Satori places (see ad-text).
  const headlineText = creative.headline ?? "";
  const ctaText = creative.cta ?? "Shop now";
  const brand = { name: FONTS[kit.font].name, data: font };
  const normalized=await sharp(Buffer.from(await photo.data.arrayBuffer()),{limitInputPixels:24e6}).rotate().resize(size.width,size.height,{fit:"cover"}).png().toBuffer();
  const faces=await detectFaces(normalized);
  const placement=chooseOverlays(aspect,faces,{headline:!!headlineText,cta:ctaText,ctaWidth:72+await measureCopyWidth(ctaText,brand),logo:!!logo?.data?.signedUrl,rtl:isRtl([headlineText,ctaText])});
  const styles = adTextStyles(aspect, textColorOn(kit.accent_color),placement);
  const [extraFonts, headline, cta] = await Promise.all([
    fontsFor([headlineText, ctaText]),
    prepareText(headlineText, styles.headline, brand),
    prepareText(ctaText, styles.cta, brand),
  ]);

  return new ImageResponse(
    <AdLayout
      photoUrl={"data:image/png;base64,"+normalized.toString("base64")}
      placement={placement}
      aspect={aspect}
      headline={headline}
      cta={cta}
      rtl={isRtl([headlineText, ctaText])}
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
        ...extraFonts,
      ],
      headers:{...headers,"x-gooidy-layout":FACE_SAFE_LAYOUT_VERSION,"x-gooidy-layout-analysis":faces===null?"fallback":"ready"},
    },
  );
}
