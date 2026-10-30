"use client";

import Image from "next/image";
import { useState } from "react";
import { SectionHeading } from "./chrome";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

// Shopify serves any width of a product photo; the card is at most 384 px
// wide, so 800 px stays sharp on retina screens. Other stores' photos load
// as they are.
function webSize(photo: string, width = 800) {
  try {
    const u = new URL(photo);
    if (u.hostname !== "cdn.shopify.com" && !u.pathname.includes("/cdn/shop/"))
      return photo;
    u.searchParams.set("width", String(width));
    return u.toString();
  } catch {
    return photo;
  }
}

// Source and generated variants share one display, never neighboring cards.
export function BeforeAfter({ photo, name, url, madeIn, ads }: {
  photo: string; name: string; url: string; madeIn?: string;
  ads: { image: string; alt: string }[];
}) {
  const [active, setActive] = useState(-1);
  const { hostname, pathname } = new URL(url);
  const store = hostname.replace(/^www\./, "");
  const { t } = useI18n();
  const ad = ads[active];
  return (
    <section className="reveal mx-auto max-w-6xl px-4 py-24">
      <SectionHeading title={t.beforeAfter.title} sub={t.beforeAfter.compareHint} />
      <div className="mt-10 flex flex-col items-center gap-6">
        <div className="flex max-w-2xl flex-wrap justify-center gap-2" aria-label={t.beforeAfter.compareHint}>
          <button type="button" aria-pressed={active === -1} onClick={() => setActive(-1)}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-medium ${active === -1 ? "border-accent bg-accent-soft" : "border-line"}`}>
            {t.beforeAfter.before}
          </button>
          {ads.map((item,i) => (
            <button key={item.image} type="button" aria-label={fmt(t.beforeAfter.imageVariant, { n: i + 1 }) + ": " + item.alt} aria-pressed={active === i}
              onClick={() => setActive(i)}
              className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-medium ${active === i ? "border-accent bg-accent-soft" : "border-line"}`}>
              {fmt(t.beforeAfter.imageVariant, { n: i + 1 })}
            </button>
          ))}
        </div>
        <figure data-single-product-display="before-after" className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-raised shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 text-xs text-muted"><span className="min-w-0 truncate">{store}{pathname}</span><span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 font-medium text-accent">{ad ? fmt(t.beforeAfter.imageVariant, { n: active + 1 }) : t.beforeAfter.before}</span></div>
          <div className="relative aspect-[9/16] bg-surface">
            {ad ? (
              <Image key={ad.image} src={ad.image} alt={ad.alt} fill sizes="384px" className="object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- source product photo may be on any store host
              <img src={webSize(photo, 480)}
                srcSet={webSize(photo, 320) === webSize(photo, 480) ? undefined : [320, 480, 640, 800, 1120].map(width => `${webSize(photo, width)} ${width}w`).join(", ")}
                sizes="(min-width: 416px) 384px, calc(100vw - 32px)" alt={name} loading="lazy" className="h-full w-full object-contain" />
            )}
          </div>
          <figcaption aria-live="polite" aria-atomic="true" className="px-4 py-3 text-sm">{ad?.alt ?? name}</figcaption>
        </figure>
        <p className="text-center text-xs text-muted">
          {fmt(t.beforeAfter.after, { count: ads.length })}{madeIn ? ` · ${madeIn}` : ""}
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-11 items-center justify-center text-sm font-medium text-accent hover:underline">{fmt(t.useCases.realPage, { store })}</a>
        </p>
      </div>
    </section>
  );
}
