import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { getBrandKit } from "@/lib/brand-kit";
import { FACE_SAFE_LAYOUT_VERSION } from "@/lib/face-safe-layout";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wantsImagePreview, makeImagePreview } from "@/lib/image-preview";
import { renderAdImage } from "@/lib/ad-image";

// The finished ad as a PNG (see renderAdImage).
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/creatives/[id]/image">,
) {
  const { id } = await ctx.params;
  let supabase: SupabaseClient = await createClient();

  // RLS: returns the row only for members of its workspace.
  let { data: creative } = await supabase
    .from("creatives")
    .select("workspace_id, storage_path, aspect, headline, cta")
    .eq("id", id)
    .eq("kind", "image")
    .maybeSingle();

  // Anyone may see ads from runs the team put on the public site.
  const showcased = !creative;
  if (showcased) {
    supabase = createAdminClient();
    ({ data: creative } = await supabase
      .from("creatives")
      .select(
        "workspace_id, storage_path, aspect, headline, cta, generations!inner(showcased_at)",
      )
      .eq("id", id)
      .eq("kind", "image")
      .not("generations.showcased_at", "is", null)
      .maybeSingle());
  }
  if (!creative) return new Response("Not found", { status: 404 });

  // Revalidate edited copy without decoding, detecting faces and rendering an
  // unchanged private photo again. Authentication/RLS always runs first.
  let etag: string | null = null;
  if (!showcased) {
    const kit = await getBrandKit(supabase, creative.workspace_id);
    etag = '"' + createHash("sha256").update(JSON.stringify([
      id, creative, kit, request.nextUrl.searchParams.toString(),
      process.env.VERCEL_GIT_COMMIT_SHA ?? FACE_SAFE_LAYOUT_VERSION,
    ])).digest("hex") + '"';
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": "private, no-cache" } });
    }
  }

  const image = await renderAdImage(supabase, creative, {
    "cache-control": showcased
      ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
      : "private, no-cache",
  });
  if (!image) return new Response("Not found", { status: 404 });

  if (wantsImagePreview(request.nextUrl.searchParams)) {
    const preview = await makeImagePreview(image);
    if (etag) preview.headers.set("etag", etag);
    return preview;
  }
  if (etag) image.headers.set("etag", etag);

  if (request.nextUrl.searchParams.get("download")) {
    image.headers.set(
      "content-disposition",
      `attachment; filename="enabler-ad-${id.slice(0, 8)}-${creative.aspect.replace(":", "x")}.png"`,
    );
  }
  return image;
}

