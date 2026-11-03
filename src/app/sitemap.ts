import type { MetadataRoute } from "next";
import { HTML_LANG, LOCALES, localePath } from "@/i18n/config";
import { SITE } from "@/lib/seo";

const PAGES = ["/", "/use-cases", "/privacy", "/terms"];

// Every public page in every language, each listing its translations.
// Pages change with each deploy, so the build time is their last update.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.flatMap((path) => {
    const languages = Object.fromEntries([
      ...LOCALES.map((l) => [HTML_LANG[l] ?? l, SITE + localePath(l, path)]),
      ["x-default", SITE + path],
    ]);
    return LOCALES.map((locale) => ({
      url: SITE + localePath(locale, path),
      lastModified,
      alternates: { languages },
    }));
  });
}
