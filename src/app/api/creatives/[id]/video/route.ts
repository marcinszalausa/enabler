import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sends the browser to a short-lived link to the finished video ad.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/creatives/[id]/video">,
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  // RLS: returns the row only for members of its workspace.
  const { data: creative } = await supabase
    .from("creatives")
    .select("storage_path, aspect")
    .eq("id", id)
    .eq("kind", "video")
    .maybeSingle();
  if (!creative) return new Response("Not found", { status: 404 });

  const download = request.nextUrl.searchParams.get("download")
    ? `gooidy-video-ad-${id.slice(0, 8)}.mp4`
    : undefined;
  const { data } = await supabase.storage
    .from("creatives")
    .createSignedUrl(creative.storage_path, 3600, { download });
  if (!data) return new Response("Not found", { status: 404 });

  return Response.redirect(data.signedUrl, 302);
}
