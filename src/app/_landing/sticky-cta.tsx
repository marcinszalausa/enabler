"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/client";

// On phones, a "Create ads" bar stays in reach once the hero's link form has
// scrolled away, and steps aside again when the closing form is on screen.
export function StickyCta() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const forms = ["url-top", "url-bottom"]
      .map((id) => document.getElementById(id)?.closest("form"))
      .filter((f): f is HTMLFormElement => !!f);
    if (!forms.length || !("IntersectionObserver" in window)) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries)
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      // Hidden while a form shows, and above the hero (before scrolling).
      setShow(visible.size === 0 && window.scrollY > 200);
    });
    forms.forEach((f) => observer.observe(f));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!show}
    >
      <Link
        href="/dashboard" prefetch={false}
        tabIndex={show ? 0 : -1}
        className="btn-primary block rounded-xl py-3 text-center font-medium"
      >
        {t.stickyCta}
      </Link>
    </div>
  );
}
