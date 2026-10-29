"use client";

import { useEffect } from "react";

// Fades sections in as they scroll into view. Elements with the `reveal`
// class start hidden only once this script runs, so nothing is lost without JS.
export function Reveal() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>(".landing .reveal");
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    document.documentElement.dataset.reveal = "on";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
