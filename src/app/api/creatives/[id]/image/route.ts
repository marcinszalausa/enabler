import type { NextRequest } from "next/server";
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

  const image = await renderAdImage(supabase, creative, {
    "cache-control": showcased
      ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
      : "private, max-age=3600",
  });
  if (!image) return new Response("Not found", { status: 404 });

  if (wantsImagePreview(request.nextUrl.searchParams)) return makeImagePreview(image);

  if (request.nextUrl.searchParams.get("download")) {
    image.headers.set(
      "content-disposition",
      `attachment; filename="enabler-ad-${id.slice(0, 8)}-${creative.aspect.replace(":", "x")}.png"`,
    );
  }
  return image;
}
