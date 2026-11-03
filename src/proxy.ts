import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isAppPath,
  isLocale,
  localePath,
  countryLocale,
  matchLocale,
  type Locale,
} from "@/i18n/config";

// Every page lives under /[locale]. English public pages and the app keep
// plain addresses (served from /en/... or the chosen language behind the
// scenes); other languages' public pages are at /de/..., /pl/... and so on.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (first === "api" || first === "auth") return updateSession(request);

  // An address with a language in it: remember the language.
  if (isLocale(first)) {
    const rest = pathname.slice(first.length + 1) || "/";
    // English and the app don't carry the language in their address.
    if (first === DEFAULT_LOCALE || isAppPath(rest)) {
      return remember(redirect(request, rest + search, 308), first);
    }
    return remember(await updateSession(request), first);
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  // Search engines get the language in the address (English here), never a
  // redirect by country, so they can index every language's page.
  const locale: Locale = isBot(request)
    ? DEFAULT_LOCALE
    : isLocale(saved)
      ? saved
      : firstVisitLocale(request);

  if (!isAppPath(pathname) && locale !== DEFAULT_LOCALE) {
    return remember(
      redirect(request, localePath(locale, pathname) + search),
      locale,
    );
  }
  const target = request.nextUrl.clone();
  target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const response = await updateSession(request, target);
  return saved === locale ? response : remember(response, locale);
}

// A browser set to one of our languages other than English is a clear
// choice. Otherwise (English is many browsers' default) go by the country
// Vercel locates the visitor in.
function firstVisitLocale(request: NextRequest): Locale {
  const browser = matchLocale(request.headers.get("accept-language"));
  if (browser && browser !== DEFAULT_LOCALE) return browser;
  return (
    countryLocale(request.headers.get("x-vercel-ip-country")) ??
    browser ??
    DEFAULT_LOCALE
  );
}

// Search engine and link preview crawlers.
const BOT =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|whatsapp|telegram/i;

function isBot(request: NextRequest) {
  return BOT.test(request.headers.get("user-agent") ?? "");
}

function redirect(request: NextRequest, to: string, status = 307) {
  return NextResponse.redirect(new URL(to, request.url), status);
}

function remember(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    // Not Next's own files, or files with an extension (images, icons, the
    // manifest, robots.txt, sitemap.xml).
    "/((?!_next/static|_next/image|.*\\.[\\w]+$).*)",
  ],
};
