"use client";

import { useI18n } from "@/i18n/client";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_NAMES,
  isLocale,
  localePath,
  type Locale,
} from "@/i18n/config";

// Picks the site's language. A native select under a small label, so it
// opens the phone's own picker. The choice is remembered for the next visit
// and for the app, which keeps one address in every language.
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();

  function choose(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const { pathname } = window.location;
    const first = pathname.split("/")[1];
    const path = isLocale(first)
      ? pathname.slice(first.length + 1) || "/"
      : pathname;
    // A full load, so the server renders the page in the new language.
    window.location.assign(
      localePath(next, path) + window.location.search + window.location.hash,
    );
  }

  return (
    <label
      className={`site-language relative flex h-9 cursor-pointer items-center gap-1.5 rounded-full text-sm text-muted transition-colors hover:bg-surface hover:text-fg ${compact ? "px-2" : "px-3"}`}
      title={t.nav.language}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
      </svg>
      <span className={compact ? "font-medium uppercase" : ""}>
        {compact ? locale : LOCALE_NAMES[locale]}
      </span>
      <select
        value={locale}
        onChange={(e) => choose(e.target.value as Locale)}
        aria-label={t.nav.language}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
