import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ad images read bundled font files at runtime; video ads also run the
  // bundled ffmpeg binary to put the headline on the clip.
  outputFileTracingIncludes: {
    "/api/creatives/*/image": ["./src/fonts/**/*"],
    "/api/generations/*/advance": [
      "./src/fonts/**/*",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
    "/dashboard/products/*": [
      "./src/fonts/**/*",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },
  // Loaded from node_modules at runtime so it can find its binary.
  serverExternalPackages: ["ffmpeg-static"],
  cacheComponents: true,
  // Ads are rendered as full-size PNGs (1080 px wide, 1.5–2.5 MB). Pages show
  // them through the image optimizer, which serves WebP at the size shown.
  images: {
    localPatterns: [
      { pathname: "/api/creatives/*/image", search: "" },
      { pathname: "/reels/**", search: "" },
    ],
    minimumCacheTTL: 86400,
  },
  // Brand kit logo uploads go through a server action (logos are capped at 2 MB).
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
