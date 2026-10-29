import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { THEME_BY_TIME } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Paste a product link and get ready-to-run ads for Facebook, Instagram and TikTok.";

// Icons and the link preview image come from the files next to this layout
// (icon.svg, apple-icon.png, opengraph-image.png, twitter-image.png).
export const metadata: Metadata = {
  metadataBase: new URL("https://gooidy.com"),
  title: "Gooidy",
  description,
  openGraph: {
    title: "Gooidy",
    description,
    siteName: "Gooidy",
    url: "/",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Gooidy", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The theme script sets data-theme before hydrating.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BY_TIME }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Cookie-free page views; shows nothing until Web Analytics is
            turned on for the project in Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
