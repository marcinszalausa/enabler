import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ad images read bundled font files at runtime; video ads also run the
  // bundled ffmpeg binary to put the headline on the clip.
  outputFileTracingIncludes: {
    "/api/creatives/*/image": ["./src/fonts/**/*", "./src/models/yunet.onnx", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"],
    "/api/generations/*/advance": [
      "./src/fonts/**/*", "./src/models/yunet.onnx", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
    "/dashboard/products/*": [
      "./src/fonts/**/*", "./src/models/yunet.onnx", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },
  // Loaded from node_modules at runtime so they can find their binaries
  // (ffmpeg; Skia, which draws Hindi and Arabic ad copy).
  serverExternalPackages: ["ffmpeg-static", "@napi-rs/canvas", "onnxruntime-web", "onnxruntime-common"],
  cacheComponents: true,
  // Ads are rendered as full-size PNGs (1080 px wide, 1.5–2.5 MB). Pages show
  // them through the image optimizer, which serves WebP at the size shown.
  images: {
    localPatterns: [
      { pathname: "/api/creatives/*/image", search: "" },
      { pathname: "/api/creatives/*/image", search: "?layout=face-aware-v2" },
      { pathname: "/reels/**", search: "" },
    ],
    minimumCacheTTL: 86400,
    imageSizes: [16, 32, 48, 64, 96, 128, 160, 192, 256, 320, 384, 480],
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
