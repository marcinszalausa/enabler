import type { MetadataRoute } from "next";
import { HTML_LANG, LOCALES, localePath } from "@/i18n/config";
import { PUBLIC_FEATURES } from "@/lib/public-information";
import {INDUSTRIES,PLATFORM_GUIDES,HELP_ARTICLES,BLOG_POSTS} from "@/lib/discovery-content";
import { SITE } from "@/lib/seo";

const PAGES = ["/", "/use-cases", "/privacy", "/terms"];

// Every public page in every language, each listing its translations.
// Pages change with each deploy, so the build time is their last update.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const translatedPages = PAGES.flatMap((path) => {
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
  const informationPages = ["/templates","/industries","/platforms","/help","/blog",...INDUSTRIES.map(p=>"/industries/"+p.slug),...PLATFORM_GUIDES.map(p=>"/platforms/"+p.slug),...HELP_ARTICLES.map(p=>"/help/"+p.slug),...BLOG_POSTS.map(p=>"/blog/"+p.slug),"/pricing", "/features", "/resources", "/about", ...PUBLIC_FEATURES.map(feature => "/features/" + feature.slug)];
  return [...translatedPages, ...informationPages.map(path => ({url: SITE + path,lastModified}))];
}


