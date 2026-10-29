import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SIZES = {
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
} as const;

// Renders the finished ad: generated photo + headline + call to action.
// Text is drawn here rather than by the image model so it's always legible.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/creatives/[id]/image">,
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  // RLS: returns the row only for members of its workspace.
  const { data: creative } = await supabase
    .from("creatives")
    .select("storage_path, aspect, headline, cta")
    .eq("id", id)
    .maybeSingle();
  if (!creative) return new Response("Not found", { status: 404 });

  const { data: signed } = await supabase.storage
    .from("creatives")
    .createSignedUrl(creative.storage_path, 300);
  if (!signed) return new Response("Not found", { status: 404 });

  const size = SIZES[creative.aspect as keyof typeof SIZES] ?? SIZES["1:1"];
  const story = creative.aspect === "9:16";

  const image = new ImageResponse(
    <div style={{ ...size, display: "flex", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
      <img
        src={signed.signedUrl}
        width={size.width}
        height={size.height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          ...size,
          objectFit: "cover",
        }}
        alt=""
      />
      <div
        style={{
          // Satori ignores `inset`; give the overlay explicit bounds.
          position: "absolute",
          top: 0,
          left: 0,
          ...size,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: story ? "160px 72px 220px" : "72px",
          backgroundImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.5) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "white",
            fontSize: story ? 92 : 80,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -1,
            width: size.width - 144,
            flexWrap: "wrap",
            textShadow: "0 2px 16px rgba(0,0,0,0.35)",
          }}
        >
          {creative.headline ?? ""}
        </div>
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              background: "white",
              color: "#111",
              fontSize: 44,
              fontWeight: 700,
              padding: "22px 44px",
              borderRadius: 999,
            }}
          >
            {creative.cta ?? "Shop now"}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      headers: { "cache-control": "private, max-age=3600" },
    },
  );

  if (request.nextUrl.searchParams.get("download")) {
    image.headers.set(
      "content-disposition",
      `attachment; filename="enabler-ad-${id.slice(0, 8)}-${creative.aspect.replace(":", "x")}.png"`,
    );
  }
  return image;
}
