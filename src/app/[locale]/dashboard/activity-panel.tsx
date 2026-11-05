"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

// The app's two side panels. The menu on the left (lg+) and the Activity
// panel on the right (xl+) each fold into a slim icon rail with the same
// button, remembered per browser. Below xl the Activity panel slides in from
// the end edge (the left in Arabic) from a top-bar button.

const WIDE = "(min-width: 1280px)";
const KEY = "gooidy-activity";
const MENU_KEY = "gooidy-menu";

// Both rails share these buttons and icons.
const railButton =
  "relative flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent";
export function PanelIcon({ side }: { side: "start" | "end" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d={side === "start" ? "M9 4v16" : "M15 4v16"} />
    </svg>
  );
}

type State = {
  wide: boolean; // panel shown as a column on wide screens
  sheet: boolean; // panel shown as an overlay on smaller screens
  toggle: () => void;
  close: () => void;
  closeSheet: () => void;
  active: number;
  setActive: (n: number) => void;
  menu: boolean; // left menu open (not folded into a rail)
  toggleMenu: () => void;
};
const Ctx = createContext<State | null>(null);
const useActivity = () => useContext(Ctx)!;

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [wide, setWide] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState(true);
  // Remember whether the visitor folded either panel.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === "hidden") setWide(false);
      if (localStorage.getItem(MENU_KEY) === "folded") setMenu(false);
    } catch {}
  }, []);
  const toggleMenu = () => {
    setMenu(!menu);
    try {
      localStorage.setItem(MENU_KEY, menu ? "folded" : "open");
    } catch {}
  };
  const saveWide = useCallback((next: boolean) => {
    setWide(next);
    try {
      localStorage.setItem(KEY, next ? "shown" : "hidden");
    } catch {}
  }, []);
  const toggle = () => (matchMedia(WIDE).matches ? saveWide(!wide) : setSheet(!sheet));
  const closeSheet = useCallback(() => setSheet(false), []);
  const close = useCallback(() => (matchMedia(WIDE).matches ? saveWide(false) : setSheet(false)), [saveWide]);
  return <Ctx.Provider value={{ wide, sheet, toggle, close, closeSheet, active, setActive, menu, toggleMenu }}>{children}</Ctx.Provider>;
}

// Top-bar button that shows or hides the panel. A dot shows while ads are
// being made.
export function ActivityToggle() {
  const { t } = useI18n();
  const { sheet, toggle, active } = useActivity();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.activity.title}
      title={t.activity.title}
      aria-expanded={sheet}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full transition hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent xl:hidden ${
        sheet ? "bg-accent-soft text-accent" : "text-muted"
      }`}
      data-activity-toggle
    >
      <PanelIcon side="end" />
      {active > 0 && <span aria-hidden className="absolute end-2 top-2 size-2.5 rounded-full border-2 border-bg bg-accent" />}
    </button>
  );
}

export function ActivityAside({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { wide, sheet, close, closeSheet } = useActivity();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sheet) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Growing to a wide screen shows the column instead.
    const media = matchMedia(WIDE);
    const resize = () => {
      if (media.matches) closeSheet();
    };
    document.addEventListener("keydown", key);
    media.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", key);
      media.removeEventListener("change", resize);
    };
  }, [sheet, close, closeSheet]);

  const { active, toggle } = useActivity();
  const folded = !wide && !sheet;
  return (
    <>
      {sheet && <div aria-hidden onClick={close} className="fixed inset-0 z-40 bg-black/40 xl:hidden" />}
      <aside
        aria-label={t.activity.title}
        data-activity-panel
        data-open={sheet || wide ? "" : undefined}
        // A tap on a link inside the overlay closes it.
        onClick={(event) => {
          if (sheet && (event.target as HTMLElement).closest("a[href]")) close();
        }}
        className={`${sheet ? "fixed inset-y-0 end-0 z-50 flex w-96 max-w-[88vw] shadow-2xl" : "hidden"} ${
          wide ? "xl:w-96" : "xl:w-16"
        } shrink-0 flex-col border-s border-line bg-bg xl:sticky xl:top-0 xl:z-auto xl:flex xl:h-dvh xl:shadow-none`}
      >
        <div className={`flex h-16 shrink-0 items-center gap-2 ${folded ? "justify-center" : "justify-between ps-5 pe-3"}`}>
          {!folded && <h2 className="text-base font-semibold">{t.activity.title}</h2>}
          {/* Wide screens: fold to a rail and back, like the menu. */}
          <button
            type="button"
            onClick={toggle}
            aria-label={folded ? t.activity.title : t.activity.hide}
            title={folded ? t.activity.title : t.activity.hide}
            aria-expanded={!folded}
            className={`${railButton} hidden xl:flex`}
            data-activity-fold
          >
            <PanelIcon side="end" />
            {folded && active > 0 && <span aria-hidden className="absolute end-1.5 top-1.5 size-2.5 rounded-full border-2 border-bg bg-accent" />}
          </button>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label={t.activity.hide}
            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg xl:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 pb-6 ${folded ? "xl:hidden" : ""}`}>{children}</div>
      </aside>
    </>
  );
}

// The left menu on desktop. Folded, it keeps only icons; the same button
// brings it back.
export function MenuFrame({ children }: { children: ReactNode }) {
  const { menu } = useActivity();
  return (
    <aside
      data-app-sidebar
      data-collapsed={menu ? undefined : ""}
      className={`sticky top-0 hidden h-dvh shrink-0 border-e border-line bg-bg lg:block ${menu ? "w-60" : "w-16"}`}
    >
      {children}
    </aside>
  );
}

export function MenuFold() {
  const { t } = useI18n();
  const { menu, toggleMenu } = useActivity();
  return (
    <button
      type="button"
      onClick={toggleMenu}
      aria-label={t.nav.menu}
      title={t.nav.menu}
      aria-expanded={menu}
      className={railButton}
      data-menu-fold
    >
      <PanelIcon side="start" />
    </button>
  );
}

// Tells the top-bar button how many runs are going, and refreshes the page
// now and then while they are, so progress moves. Refreshing only reads.
export function ActiveRuns({ count }: { count: number }) {
  const { setActive } = useActivity();
  const router = useRouter();
  useEffect(() => setActive(count), [count, setActive]);
  useEffect(() => {
    if (!count) return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 20_000);
    return () => clearInterval(timer);
  }, [count, router]);
  return null;
}

// A post time in the visitor's own time zone and language.
export function LocalTime({ iso }: { iso: string }) {
  const { locale } = useI18n();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)));
  }, [iso, locale]);
  return <time dateTime={iso}>{text ?? " "}</time>;
}
