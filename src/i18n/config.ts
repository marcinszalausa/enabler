// The languages gooidy.com is offered in. English lives at the root
// (gooidy.com/use-cases); the others under their code (gooidy.com/de/...).
// The signed-in app (/dashboard) and sign-in keep their addresses in every
// language and follow the visitor's chosen language instead.

export const LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "pl",
  "nl",
  "sv",
  "tr",
  "ro",
  "cs",
  "ja",
  "ko",
  "zh",
  "hi",
  "ar",
] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Remembers the visitor's language between visits.
export const LOCALE_COOKIE = "gooidy-locale";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pl: "Polski",
  nl: "Nederlands",
  sv: "Svenska",
  tr: "Türkçe",
  ro: "Română",
  cs: "Čeština",
  ja: "日本語",
  ko: "한국어",
  zh: "简体中文",
  hi: "हिन्दी",
  ar: "العربية",
};

// The tag for <html lang> and hreflang, where it differs from the code.
export const HTML_LANG: Partial<Record<Locale, string>> = { zh: "zh-Hans" };

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function dirOf(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

// Pages whose address is the same in every language.
const APP_PATHS = ["/dashboard", "/login"];

export function isAppPath(path: string) {
  return APP_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

// The address of a page in a language: "/pricing" in German is "/de/pricing".
export function localePath(locale: Locale, path: string) {
  if (locale === DEFAULT_LOCALE || isAppPath(path)) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

// The best supported language in an Accept-Language header, if any.
export function matchLocale(header: string | null): Locale | null {
  if (!header) return null;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((w) => w.tag && w.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

// The main language of countries where one of ours is clearly spoken by
// most people. Countries split between languages (Belgium, Switzerland,
// Canada) and India, where many prefer English, are left out.
const COUNTRY_LOCALE: Record<string, Locale> = {
  ...spread(
    "es",
    "ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR",
  ),
  ...spread("pt", "BR PT AO MZ"),
  ...spread("fr", "FR MC SN CI"),
  ...spread("de", "DE AT LI"),
  ...spread("it", "IT SM"),
  ...spread("pl", "PL"),
  ...spread("nl", "NL"),
  ...spread("sv", "SE"),
  ...spread("tr", "TR"),
  ...spread("ro", "RO MD"),
  ...spread("cs", "CZ"),
  ...spread("ja", "JP"),
  ...spread("ko", "KR"),
  ...spread("zh", "CN"),
  ...spread("ar", "SA AE EG QA KW BH OM JO IQ LB SY YE LY DZ MA TN SD"),
};

function spread(locale: Locale, countries: string) {
  return Object.fromEntries(countries.split(" ").map((c) => [c, locale]));
}

export function countryLocale(country: string | null): Locale | null {
  return (country && COUNTRY_LOCALE[country.toUpperCase()]) || null;
}

// Canonical and hreflang links for a public page, so search engines show
// each visitor the page in their language.
export function alternates(locale: Locale, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: Object.fromEntries([
      ...LOCALES.map((l) => [HTML_LANG[l] ?? l, localePath(l, path)]),
      ["x-default", path],
    ]),
  };
}
