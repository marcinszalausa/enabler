import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

// Pieces shared by the public pages: nav, link form, footer.

// The Gooidy logo: "gooidy" with the g set in an indigo tile, the rest in the
// text color. Drawn as paths (Geist SemiBold) so it looks the same everywhere.
// The same files live in public/brand for use outside the site.
const G_PATH =
  "M19.45 1 32.65 0.1Q33.65 3.3 36.2 4.9Q38.75 6.5 43.75 6.5Q56.05 6.5 56.05 -4.4V-11.2Q54.15 -7.3 49.95 -4.95Q45.75 -2.6 40.55 -2.6Q33.95 -2.6 28.8 -5.85Q23.65 -9.1 20.75 -15Q17.85 -20.9 17.85 -28.5Q17.85 -36.1 20.7 -42Q23.55 -47.9 28.7 -51.25Q33.85 -54.6 40.35 -54.6Q46.05 -54.6 50.25 -52.05Q54.45 -49.5 56.45 -45.1V-53.4H68.95V-4.7Q68.95 5.4 62.15 10.8Q55.35 16.2 43.75 16.2Q33.55 16.2 27.45 12.15Q21.35 8.1 19.45 1ZM56.15 -28.9Q56.15 -36.2 52.75 -40.4Q49.35 -44.6 43.55 -44.6Q37.75 -44.6 34.45 -40.3Q31.15 -36 31.15 -28.6Q31.15 -21.2 34.5 -16.9Q37.85 -12.6 43.55 -12.6Q49.45 -12.6 52.8 -16.95Q56.15 -21.3 56.15 -28.9Z";
const OOIDY_PATH =
  "M95.9 -26.7Q95.9 -35.1 99.15 -41.4Q102.4 -47.7 108.35 -51.15Q114.3 -54.6 122.2 -54.6Q130 -54.6 135.95 -51.15Q141.9 -47.7 145.15 -41.4Q148.4 -35.1 148.4 -26.7Q148.4 -18.3 145.15 -12Q141.9 -5.7 135.95 -2.25Q130 1.2 122.2 1.2Q114.3 1.2 108.35 -2.25Q102.4 -5.7 99.15 -12Q95.9 -18.3 95.9 -26.7ZM135.2 -26.7Q135.2 -35 131.75 -39.6Q128.3 -44.2 122.2 -44.2Q116 -44.2 112.6 -39.6Q109.2 -35 109.2 -26.7Q109.2 -18.4 112.6 -13.8Q116 -9.2 122.2 -9.2Q128.4 -9.2 131.8 -13.8Q135.2 -18.4 135.2 -26.7ZM154.1 -26.7Q154.1 -35.1 157.35 -41.4Q160.6 -47.7 166.55 -51.15Q172.5 -54.6 180.4 -54.6Q188.2 -54.6 194.15 -51.15Q200.1 -47.7 203.35 -41.4Q206.6 -35.1 206.6 -26.7Q206.6 -18.3 203.35 -12Q200.1 -5.7 194.15 -2.25Q188.2 1.2 180.4 1.2Q172.5 1.2 166.55 -2.25Q160.6 -5.7 157.35 -12Q154.1 -18.3 154.1 -26.7ZM193.4 -26.7Q193.4 -35 189.95 -39.6Q186.5 -44.2 180.4 -44.2Q174.2 -44.2 170.8 -39.6Q167.4 -35 167.4 -26.7Q167.4 -18.4 170.8 -13.8Q174.2 -9.2 180.4 -9.2Q186.6 -9.2 190 -13.8Q193.4 -18.4 193.4 -26.7ZM215.2 -53.4H228V0H215.2ZM215 -71.9H228.3V-60.5H215ZM236.7 -26.7Q236.7 -35.2 239.45 -41.5Q242.2 -47.8 247.2 -51.2Q252.2 -54.6 258.9 -54.6Q264.4 -54.6 268.65 -52.25Q272.9 -49.9 275.1 -45.8V-71H287.9V0H275.8L275.5 -7.9Q273.2 -3.6 268.8 -1.2Q264.4 1.2 258.9 1.2Q252.1 1.2 247.1 -2.2Q242.1 -5.6 239.4 -11.9Q236.7 -18.2 236.7 -26.7ZM275.1 -26.7Q275.1 -35.2 271.9 -39.7Q268.7 -44.2 262.7 -44.2Q256.8 -44.2 253.4 -39.5Q250 -34.8 250 -26.7Q250 -18.7 253.45 -13.95Q256.9 -9.2 262.7 -9.2Q268.6 -9.2 271.85 -13.75Q275.1 -18.3 275.1 -26.7ZM303.2 5.1H310Q312.6 5.1 313.85 4.3Q315.1 3.5 315.9 1.6L317.3 -2.1H313.6L294.6 -53.4H307.8L321.3 -14.1L334 -53.4H347.3L326.4 5.6Q324.7 10.6 321.4 12.8Q318.1 15 312.3 15H303.2Z";

export function Logo() {
  return (
    <Link
      href="/"
      aria-label="Gooidy home"
      className="flex items-center text-fg"
    >
      <svg viewBox="0 -72.9 348.3 98.1" className="h-7 w-auto" role="img">
        <title>Gooidy</title>
        <defs>
          <linearGradient
            id="gooidy-g"
            x1="0"
            y1="-62.6"
            x2="86.8"
            y2="24.2"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect
          y="-62.6"
          width="86.8"
          height="86.8"
          rx="20.8"
          fill="url(#gooidy-g)"
        />
        <path fill="#fff" d={G_PATH} />
        <path fill="currentColor" d={OOIDY_PATH} />
      </svg>
    </Link>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          <Link href="/use-cases" className="hover:text-fg">
            Examples
          </Link>
          <Link href="/#how" className="hover:text-fg">
            How it works
          </Link>
          <Link href="/#angles" className="hover:text-fg">
            Ad angles
          </Link>
          <Link href="/#pricing" className="hover:text-fg">
            Pricing
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-surface"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="btn-primary hidden rounded-lg px-4 py-2 text-sm font-medium sm:block"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function UrlForm({ id }: { id: string }) {
  // A plain GET form: signed-out visitors go through sign-in and land on the
  // dashboard with the link already filled in.
  return (
    <form
      action="/dashboard"
      method="get"
      className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
    >
      <label htmlFor={id} className="sr-only">
        Your product or store link
      </label>
      <input
        id={id}
        name="url"
        type="text"
        inputMode="url"
        placeholder="Paste your product or store link"
        className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-fg shadow-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20"
      />
      <button
        type="submit"
        className="btn-primary rounded-xl px-6 py-3 font-medium"
      >
        Create ads
      </button>
    </form>
  );
}

export function SectionHeading({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
        {title}
      </h2>
      {sub && <p className="mt-3 text-lg text-muted">{sub}</p>}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row">
        <Logo />
        <p>© 2026 Gooidy</p>
        <div className="flex gap-6">
          <Link href="/use-cases" className="hover:text-fg">
            Examples
          </Link>
          <Link href="/#pricing" className="hover:text-fg">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-fg">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

// Top bar for the signed-in app and the sign-in page: same logo, colors and
// theme switch as the public site, with the page's own links on the right.
export function AppBar({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Logo />
        <div className="flex items-center gap-1 text-sm">
          {children}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
