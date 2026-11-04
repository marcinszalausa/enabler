"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";

// The "⋯" menu on a card: secondary and destructive actions live here, so a
// stray tap on the card can't delete anything.
export function MoreMenu({ items, className }: {
  items: { label: string; onSelect: () => void; danger?: boolean; icon?: ReactNode; testId?: string }[];
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={root} className={className ?? "relative"}>
      <button
        type="button"
        data-more-menu
        aria-label={t.remove.more}
        title={t.remove.more}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-fg"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full end-0 z-20 mb-1 min-w-44 overflow-hidden rounded-xl border border-line bg-raised py-1 shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-menu-item={item.testId}
              onClick={() => { setOpen(false); item.onSelect(); }}
              className={"flex min-h-11 w-full items-center gap-2.5 px-4 text-start text-sm transition hover:bg-surface " + (item.danger ? "text-danger" : "text-fg")}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
