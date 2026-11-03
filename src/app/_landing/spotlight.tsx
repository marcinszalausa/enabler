"use client";

import { useEffect } from "react";

// Feeds the cursor position to `.spot` cards, which draw a soft light there.
export function Spotlight() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
      const card = (e.target as Element).closest<HTMLElement>(".landing .spot");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => { removeEventListener("pointermove", onMove); cancelAnimationFrame(frame); };
  }, []);

  return null;
}
