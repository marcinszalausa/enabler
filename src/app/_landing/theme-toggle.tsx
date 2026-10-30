"use client";

import { useI18n } from "@/i18n/client";

const THEME_KEY = "gooidy-theme";

// Flips between light and dark and remembers the choice on this device.
// Both icons are rendered; CSS shows the right one, so nothing flashes.
export function ThemeToggle() {
  const { t } = useI18n();
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.nav.theme}
      title={t.nav.themeShort}
      className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-fg"
    >
      {/* Sun: shown in dark mode, switches to light. */}
      <svg
        viewBox="0 0 24 24"
        className="theme-icon-sun h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      {/* Moon: shown in light mode, switches to dark. */}
      <svg
        viewBox="0 0 24 24"
        className="theme-icon-moon h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
