"use client";

import Image from "next/image";
import { useState } from "react";
import { useAngles, useI18n } from "@/i18n/client";

export type AngleAd = {
  id: string;
  angle: string;
  headline: string;
  primaryText: string;
  image: string;
};

// One real run, several angles: each tab shows the actual feed ad Gooidy
// made for that angle, with the caption it wrote, as it would post.
export function AngleExplorer({
  store,
  ads,
}: {
  store: string;
  ads: AngleAd[];
}) {
  const [active, setActive] = useState(0);
  const ad = ads[active];
  const { t } = useI18n();
  const angle = useAngles();

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        role="tablist"
        aria-label={t.feed.angleTabs}
      >
        {ads.map((a, i) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`flex shrink-0 flex-col whitespace-nowrap rounded-xl border px-4 py-2.5 text-left text-sm transition-colors lg:whitespace-normal lg:px-5 lg:py-4 ${
              i === active
                ? "border-accent bg-accent-soft text-fg"
                : "border-line text-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            <span className="font-medium lg:text-base">
              {angle.name(a.angle)}
            </span>
            {angle.idea(a.angle) && (
              <span className="mt-0.5 hidden text-sm text-muted lg:block">
                {angle.idea(a.angle)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* The feed post as it would run. */}
      <div className="edge mx-auto w-full max-w-md overflow-hidden shadow-[0_30px_80px_-35px_rgb(var(--t-shadow)/0.45)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet text-xs font-semibold uppercase text-white">
            {store.slice(0, 1)}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-medium">{store.split(".")[0]}</p>
            <p className="text-xs text-muted">{t.feed.sponsored}</p>
          </div>
        </div>
        <div className="relative aspect-square overflow-hidden bg-surface">
          <Image key={ad.id} src={ad.image} alt={ad.headline} fill
            sizes="(min-width: 28rem) 448px, 100vw" className="object-cover" />
        </div>
        <p
          key={ad.primaryText}
          className="angle-in px-4 py-4 text-sm text-muted"
        >
          {ad.primaryText}
        </p>
      </div>
    </div>
  );
}
