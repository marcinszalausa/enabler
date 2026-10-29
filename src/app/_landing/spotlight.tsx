"use client";

import { useEffect } from "react";

// Feeds the cursor position to `.spot` cards, which draw a soft light there.
export function Spotlight() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element).closest<HTMLElement>(".landing .spot");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => removeEventListener("pointermove", onMove);
  }, []);

  return null;
}
