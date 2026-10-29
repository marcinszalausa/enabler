import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ad images read bundled font files at runtime.
  outputFileTracingIncludes: {
    "/api/creatives/*/image": ["./src/fonts/**/*"],
  },
  cacheComponents: true,
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
