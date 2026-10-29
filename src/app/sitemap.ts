import type { MetadataRoute } from "next";
import { HTML_LANG, LOCALES, localePath } from "@/i18n/config";

const SITE = "https://gooidy.com";
const PAGES = ["/", "/use-cases", "/privacy", "/terms"];

// Every public page in every language, each listing its translations.
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((path) => {
    const languages = Object.fromEntries(
      LOCALES.map((l) => [HTML_LANG[l] ?? l, SITE + localePath(l, path)]),
    );
    return LOCALES.map((locale) => ({
      url: SITE + localePath(locale, path),
      alternates: { languages },
    }));
  });
}
