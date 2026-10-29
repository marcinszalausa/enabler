import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Sends the browser to a short-lived link to the finished video ad.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/creatives/[id]/video">,
) {
  const { id } = await ctx.params;
  let supabase: SupabaseClient = await createClient();

  // RLS: returns the row only for members of its workspace.
  let { data: creative } = await supabase
    .from("creatives")
    .select("storage_path, aspect")
    .eq("id", id)
    .eq("kind", "video")
    .maybeSingle();

  // Anyone may see ads from runs the team put on the public site.
  const showcased = !creative;
  if (showcased) {
    supabase = createAdminClient();
    ({ data: creative } = await supabase
      .from("creatives")
      .select("storage_path, aspect, generations!inner(showcased_at)")
      .eq("id", id)
      .eq("kind", "video")
      .not("generations.showcased_at", "is", null)
      .maybeSingle());
  }
  if (!creative) return new Response("Not found", { status: 404 });

  const download = request.nextUrl.searchParams.get("download")
    ? `gooidy-video-ad-${id.slice(0, 8)}.mp4`
    : undefined;
  // Public links are cached for an hour, so they must outlive that.
  const { data } = await supabase.storage
    .from("creatives")
    .createSignedUrl(creative.storage_path, showcased ? 7200 : 3600, {
      download,
    });
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      location: data.signedUrl,
      "cache-control": showcased
        ? "public, max-age=3600, s-maxage=3600"
        : "private, no-store",
    },
  });
}
