"use client";

import { useEffect, useState, type ReactNode } from "react";

// The sticky header around the site nav. Marks itself once the page has
// scrolled, so the nav can turn into a floating pill (see .site-nav).
export function NavShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-30 px-3"
    >
      {children}
    </header>
  );
}
