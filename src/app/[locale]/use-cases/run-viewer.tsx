"use client";

import Image from "next/image";
import { useState } from "react";
import type { ShowcaseRun } from "@/lib/showcase";
import { useAngles, useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

// One real run, shown the way it looks in Gooidy: the link, what Gooidy read
// from the page, then each angle's feed and story ads side by side.
export function RunViewer({
  run,
  took,
}: {
  run: ShowcaseRun;
  took: string | null;
}) {
  const angles = [...new Set(run.ads.map((a) => a.angle))];
  const [active, setActive] = useState(angles[0]);
  const square = run.ads.find((a) => a.angle === active && a.aspect === "1:1");
  const story = run.ads.find((a) => a.angle === active && a.aspect === "9:16");
  const copy = square ?? story;
  const { t } = useI18n();
  const angle = useAngles();

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-raised shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)]">
      {/* The link, as pasted. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2 rounded-lg sm:basis-auto border border-line bg-surface px-3 py-2 text-sm">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
          </svg>
          <span className="truncate">
            {run.productUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-1 text-xs font-medium text-ok">
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
          {fmt(took ? t.useCases.adsIn : t.useCases.ads, {
            count: run.ads.length,
            time: took ?? "",
          })}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        {/* What Gooidy read from the page. */}
        <aside className="border-b border-line bg-surface p-5 text-sm sm:p-6 lg:border-b-0 lg:border-r">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {t.useCases.read}
          </p>
          {run.summary && <p className="mt-3 leading-relaxed">{run.summary}</p>}
          {run.audience && (
            <>
              <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">
                {t.useCases.buyers}
              </p>
              <p className="mt-2 leading-relaxed text-muted">{run.audience}</p>
            </>
          )}
          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">
            {t.useCases.written}
          </p>
          <div
            className="-mx-1 mt-2 flex flex-wrap gap-1.5"
            role="tablist"
            aria-label={fmt(t.useCases.anglesFor, { product: run.productName })}
          >
            {angles.map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={a === active}
                onClick={() => setActive(a)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  a === active
                    ? "border-accent bg-bg text-fg shadow-sm"
                    : "border-transparent text-muted hover:bg-bg hover:text-fg"
                }`}
              >
                {angle.name(a)}
              </button>
            ))}
          </div>
          {angle.idea(active) && (
            <p className="mt-3 leading-relaxed text-muted">
              {angle.idea(active)}
            </p>
          )}
        </aside>

        {/* The ads for the chosen angle. */}
        <div className="p-5 sm:p-6">
          <div className="grid items-start gap-4 grid-cols-[1fr_0.5625fr]">
            {square && (
              <figure>
                <Image
                  key={square.id}
                  src={`/api/creatives/${square.id}/image`}
                  alt={square.headline}
                  width={1080}
                  height={1080}
                  sizes="(min-width: 64rem) 420px, 60vw"
                  className="angle-in aspect-square w-full rounded-xl border border-line bg-surface object-cover"
                />
                <figcaption className="mt-2 text-xs text-muted">
                  {t.useCases.feed}
                </figcaption>
              </figure>
            )}
            {story && (
              <figure>
                <Image
                  key={story.id}
                  src={`/api/creatives/${story.id}/image`}
                  alt={story.headline}
                  width={1080}
                  height={1920}
                  sizes="(min-width: 64rem) 240px, 34vw"
                  className="angle-in aspect-[9/16] w-full rounded-xl border border-line bg-surface object-cover"
                />
                <figcaption className="mt-2 text-xs text-muted">
                  {t.useCases.story}
                </figcaption>
              </figure>
            )}
          </div>
          {copy?.primaryText && (
            <div className="mt-5 rounded-xl border border-line p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t.useCases.adText}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{copy.primaryText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
