"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

// The right-hand Activity panel. On wide screens (xl, 1280px+) it is a third
// column that can be hidden; below that it slides in from the end edge (the
// left in Arabic) when the top-bar button is pressed.

const WIDE = "(min-width: 1280px)";
const KEY = "gooidy-activity";

type State = {
  wide: boolean; // panel shown as a column on wide screens
  sheet: boolean; // panel shown as an overlay on smaller screens
  toggle: () => void;
  close: () => void;
  closeSheet: () => void;
  active: number;
  setActive: (n: number) => void;
};
const Ctx = createContext<State | null>(null);
const useActivity = () => useContext(Ctx)!;

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [wide, setWide] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(0);
  // Remember whether the visitor hid the panel on wide screens.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === "hidden") setWide(false);
    } catch {}
  }, []);
  const saveWide = useCallback((next: boolean) => {
    setWide(next);
    try {
      localStorage.setItem(KEY, next ? "shown" : "hidden");
    } catch {}
  }, []);
  const toggle = () => (matchMedia(WIDE).matches ? saveWide(!wide) : setSheet(!sheet));
  const closeSheet = useCallback(() => setSheet(false), []);
  const close = useCallback(() => (matchMedia(WIDE).matches ? saveWide(false) : setSheet(false)), [saveWide]);
  return <Ctx.Provider value={{ wide, sheet, toggle, close, closeSheet, active, setActive }}>{children}</Ctx.Provider>;
}

// Top-bar button that shows or hides the panel. A dot shows while ads are
// being made.
export function ActivityToggle() {
  const { t } = useI18n();
  const { wide, sheet, toggle, active } = useActivity();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.activity.title}
      title={t.activity.title}
      aria-expanded={sheet}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full transition hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent ${
        sheet ? "bg-accent-soft text-accent" : "text-muted"
      } ${wide ? "xl:bg-accent-soft xl:text-accent" : "xl:bg-transparent xl:text-muted"}`}
      data-activity-toggle
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M15 4v16" />
      </svg>
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
        className={`${sheet ? "fixed inset-y-0 end-0 z-50 flex w-80 max-w-[85vw] shadow-2xl" : "hidden"} ${
          wide ? "xl:sticky xl:top-0 xl:z-auto xl:flex xl:h-dvh xl:w-80 xl:shadow-none" : "xl:hidden"
        } shrink-0 flex-col border-s border-line bg-bg`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
          <h2 className="text-base font-semibold">{t.activity.title}</h2>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label={t.activity.hide}
            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
      </aside>
    </>
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
