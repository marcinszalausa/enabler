import type { Metadata } from "next";
import { HTML_LANG, alternates, localePath, type Locale } from "@/i18n/config";
import preview from "@/app/[locale]/opengraph-image.png";

export const SITE = "https://gooidy.com";

// Title, description, language links and link preview for a public page.
// Next replaces the layout's openGraph and twitter objects instead of
// merging them, and then drops the layout's preview image, so each page
// sets the whole preview, image included.
export function pageMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
): Metadata {
  const images = [{ url: preview.src, width: 1200, height: 630 }];
  return {
    title,
    description,
    alternates: alternates(locale, path),
    openGraph: {
      title,
      description,
      siteName: "Gooidy",
      url: localePath(locale, path),
      locale: HTML_LANG[locale] ?? locale,
      type: "website",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

// Structured data for the home page: who makes Gooidy, the site, and the
// product with its plans, so search engines show the name, logo and prices.
export function homeJsonLd(
  locale: Locale,
  description: string,
  plans: { name: string; price: number }[],
) {
  const url = SITE + localePath(locale, "/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "Gooidy",
        url: SITE,
        logo: `${SITE}/brand/icon-512.png`,
        email: "hello@gooidy.com",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        name: "Gooidy",
        url: SITE,
        inLanguage: HTML_LANG[locale] ?? locale,
        publisher: { "@id": `${SITE}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "Gooidy",
        url,
        description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisher: { "@id": `${SITE}/#organization` },
        offers: plans.map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: p.price,
          priceCurrency: "USD",
        })),
      },
    ],
  };
}
