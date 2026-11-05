"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/app/_landing/chrome";
import { LanguageSwitcher } from "@/app/_landing/language-switcher";
import { ThemeToggle } from "@/app/_landing/theme-toggle";
import { useI18n } from "@/i18n/client";

// The signed-in app's frame: a left sidebar with the sections and the account,
// and a top bar with Create new, Boost and the credit balance. On phones and
// tablets the sidebar becomes a drawer behind the menu button.

// What the sidebar holds, shared by the desktop sidebar and the phone drawer.
// Inside a folded desktop sidebar ([data-collapsed]) only icons stay.
export function SidebarBody({
  nav,
  account,
  extra,
  fold,
}: {
  nav: ReactNode;
  account: ReactNode;
  extra?: ReactNode;
  // The desktop button that folds the sidebar into a rail.
  fold?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 ps-5 pe-3 in-data-collapsed:justify-center in-data-collapsed:px-0">
        <div className="in-data-collapsed:hidden">
          <Logo to="/dashboard" label={t.app.products} />
        </div>
        {fold}
      </div>
      <nav
        aria-label={t.app.dashboard}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3 in-data-collapsed:px-2"
      >
        {nav}
      </nav>
      <div className="flex shrink-0 flex-col gap-2 px-3 pb-3 in-data-collapsed:px-2">
        {extra}
        <div className="flex items-center justify-between gap-1 px-1 in-data-collapsed:justify-center in-data-collapsed:px-0">
          <div className="in-data-collapsed:hidden">
            <LanguageSwitcher />
          </div>
          <ThemeToggle />
        </div>
        {account}
      </div>
    </div>
  );
}

// Phones and tablets: a menu button and the logo; the sidebar opens as a
// drawer from the start edge (the right in Arabic).
export function MobileMenu({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Growing to desktop width shows the real sidebar instead.
    const desktop = matchMedia("(min-width: 1024px)");
    const resize = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = before;
      desktop.removeEventListener("change", resize);
    };
  }, [open]);

  return (
    <div className="flex min-w-0 items-center gap-1 lg:hidden">
      <button
        type="button"
        aria-label={t.nav.menu}
        aria-expanded={open}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
        data-app-menu
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="shrink-0">
        <Logo to="/dashboard" label={t.app.products} />
      </div>
      <dialog
        ref={dialog}
        aria-label={t.nav.menu}
        onClose={() => setOpen(false)}
        // A tap on the dimmed page, or on a link, closes the drawer.
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target === event.currentTarget || target.closest("a[href]")) {
            event.currentTarget.close();
          }
        }}
        className="app-drawer fixed inset-y-0 start-0 end-auto m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 border-e border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/40"
        data-app-drawer
      >
        <div className="relative h-full">
          <button
            type="button"
            aria-label={t.app.closeMenu}
            onClick={() => dialog.current?.close()}
            className="absolute end-3 top-2.5 z-10 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
          {open && children}
        </div>
      </dialog>
    </div>
  );
}

// The main action: add a product from a link. On the Products page it jumps
// to the link box; elsewhere it opens Products with the box ready.
export function CreateNew() {
  const { t } = useI18n();
  return (
    <Link
      href="/dashboard#add"
      onClick={(event) => {
        const input = document.getElementById("url");
        if (!input) return;
        event.preventDefault();
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus({ preventScroll: true });
      }}
      className="btn-primary inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap sm:px-4"
      aria-label={t.app.createNew}
      data-create-new
    >
      <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="hidden sm:inline">{t.app.createNew}</span>
    </Link>
  );
}

const SPARK = (
  <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" aria-hidden>
    <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z" />
    <path d="M19 15.5c.25 1.6 1 2.35 2.5 2.5-1.5.25-2.25 1-2.5 2.5-.25-1.5-1-2.25-2.5-2.5 1.5-.15 2.25-.9 2.5-2.5Z" />
  </svg>
);

// Boost isn't built yet: a quiet button that explains what's coming.
export function BoostTeaser({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) root.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      ref={root}
      className={`relative ${className}`}
      data-boost
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium whitespace-nowrap text-fg transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent sm:px-4">
        <span className="text-accent">{SPARK}</span>
        {t.why.soonTitle}
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
          {t.why.soon}
        </span>
      </summary>
      <div className="absolute end-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-bg p-4 shadow-xl">
        <BoostNote />
      </div>
    </details>
  );
}

// The same teaser as a small card, for the phone drawer.
export function BoostCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3" data-boost-card>
      <BoostNote />
    </div>
  );
}

function BoostNote() {
  const { t } = useI18n();
  return (
    <>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <span className="text-accent">{SPARK}</span>
        {t.why.soonTitle}
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
          {t.why.soon}
        </span>
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.why.soonBody}</p>
    </>
  );
}
