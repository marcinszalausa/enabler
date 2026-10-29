import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gooidy",
    short_name: "Gooidy",
    description:
      "Paste a product link and get ready-to-run ads for Facebook, Instagram and TikTok.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d14",
    theme_color: "#4f46e5",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/gooidy-mark.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
