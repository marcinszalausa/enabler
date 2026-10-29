import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

// Pieces shared by the public pages: theme script, nav, link form, footer.

// Picks light or dark before first paint: ?theme=, then the saved choice,
// then the visitor's local time.
export const THEME_BY_TIME = `(function(){var d=document.documentElement,t;try{t=new URLSearchParams(location.search).get("theme");if(t!=="light"&&t!=="dark")t=localStorage.getItem("gooidy-theme")}catch(e){}if(t!=="light"&&t!=="dark"){var h=new Date().getHours();t=h>=7&&h<19?"light":"dark"}d.dataset.theme=t})()`;

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-xl font-semibold tracking-tight"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
      gooidy
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
            className="dark-accent-text hidden rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 sm:block"
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
        className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-fg shadow-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15"
      />
      <button
        type="submit"
        className="dark-accent-text rounded-xl bg-accent px-6 py-3 font-medium text-white shadow-sm transition hover:brightness-110"
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
