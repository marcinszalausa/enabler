"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { IMAGE_CREDITS, QUALITIES, VIDEO_CREDITS_PER_SECOND, type Quality } from "@/lib/quality";

export type TierExample = { imageId: string | null; headline: string; videoId: string | null };

// The same product at each quality tier, from real showcased runs. Shown only
// when at least two tiers have an example, so there is a difference to see.
export function TierCompare({ examples }: { examples: Record<Quality, TierExample> }) {
  const { t } = useI18n();
  const shown = QUALITIES.filter((q) => examples[q].imageId || examples[q].videoId);
  if (shown.length < 2) return null;
  const hasVideo = shown.some((q) => examples[q].videoId);
  return (
    <div data-tier-compare className="mt-12">
      <div className="max-w-2xl">
        <h3 className="text-2xl font-semibold tracking-tight">{t.home.tierTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.home.tierSub}</p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {QUALITIES.map((q) => {
          const ex = examples[q];
          return (
            <figure key={q} data-tier={q} className={`flex flex-col overflow-hidden rounded-2xl border bg-raised ${q === "best" ? "border-accent shadow-[0_24px_60px_-30px_var(--t-accent)]" : "border-line"}`}>
              <figcaption className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                <span className={`font-semibold ${q === "best" ? "text-accent" : ""}`}>{t.app.qualities[q]}</span>
                <span className="text-xs text-muted">{fmt(t.home.tierPerImage, { count: IMAGE_CREDITS[q] })}</span>
              </figcaption>
              {ex.imageId ? (
                <Image src={`/api/creatives/${ex.imageId}/image?layout=face-aware-v2`} alt={ex.headline}
                  width={1080} height={1080} sizes="(min-width: 40rem) 33vw, 90vw"
                  className="aspect-square w-full bg-surface object-cover" />
              ) : (
                <div className="aspect-square w-full bg-surface" />
              )}
              {hasVideo && (
                <div className="flex flex-col gap-2 border-t border-line p-4">
                  <span className="text-xs text-muted">{fmt(t.home.tierPerSecond, { count: VIDEO_CREDITS_PER_SECOND[q] })}</span>
                  {ex.videoId ? (
                    <video src={`/api/creatives/${ex.videoId}/video`} muted loop playsInline controls preload="none"
                      className="mx-auto aspect-[9/16] w-2/3 rounded-xl bg-surface object-cover" />
                  ) : (
                    <div className="mx-auto aspect-[9/16] w-2/3 rounded-xl bg-surface" />
                  )}
                </div>
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
