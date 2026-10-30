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
      <SectionHeading title={t.beforeAfter.title} sub={store} />
      <div className="mt-10 flex flex-col items-center gap-6">
        <div className="flex max-w-2xl flex-wrap justify-center gap-2">
          <button type="button" aria-pressed={active === -1} onClick={() => setActive(-1)}
            className={`rounded-lg border px-4 py-2 text-sm ${active === -1 ? "border-accent bg-accent-soft" : "border-line"}`}>
            {t.beforeAfter.before}
          </button>
          {ads.map((item,i) => (
            <button key={item.image} type="button" aria-label={item.alt} aria-pressed={active === i}
              onClick={() => setActive(i)}
              className={`rounded-lg border px-4 py-2 text-sm ${active === i ? "border-accent bg-accent-soft" : "border-line"}`}>
              {i + 1}
            </button>
          ))}
        </div>
        <figure data-single-product-display="before-after" className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-raised shadow-xl">
          <div className="truncate border-b border-line bg-surface px-4 py-3 text-xs text-muted">{store}{pathname}</div>
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
          <figcaption className="px-4 py-3 text-sm">{ad?.alt ?? name}</figcaption>
        </figure>
        <p className="text-center text-xs text-muted">
          {fmt(t.beforeAfter.after, { count: ads.length })}{madeIn ? ` · ${madeIn}` : ""}
        </p>
      </div>
    </section>
  );
}
