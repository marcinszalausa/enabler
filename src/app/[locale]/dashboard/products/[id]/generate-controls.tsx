"use client";

import { useState } from "react";
import { LANGUAGES, languageOption, type LanguageKey } from "@/lib/languages";
import { useI18n } from "@/i18n/client";
import { GenerateButton } from "./generate-button";
import { VideoAdForm } from "./video-ad-form";
import { fmt } from "@/i18n/format";
import { ADS_PER_GENERATION, ASPECTS, IDEA_COUNTS, imageRunCost, type IdeaCount } from "@/lib/image-pricing";
import { DEFAULT_VIDEO_OPTIONS, videoRunCost } from "@/lib/video-options";
import { DEFAULT_IMAGE_QUALITY, DEFAULT_VIDEO_QUALITY, QUALITIES, type Quality } from "@/lib/quality";

// A real showcased ad per tier: creative ids, null where none is shown yet.
export type TierExampleIds = Record<"image" | "video", Record<Quality, string | null>>;

// One language for the next run, image or video. Starts at the language the
// product page is written in.
export function GenerateControls({
  productId,
  imageRequestId,
  videoRequestId,
  videoLabel,
  defaultLanguage,
  initialKind,
  credits,
  freeTrial = false,
  examples,
}: {
  productId: string;
  imageRequestId: string;
  videoRequestId: string;
  // Prices now follow the chosen quality; kept for older callers.
  imageCost?: number;
  videoCost?: number;
  videoLabel: string;
  defaultLanguage: LanguageKey;
  initialKind?: "image" | "video";
  credits?: number;
  freeTrial?: boolean;
  examples?: TierExampleIds;
}) {
  const [language, setLanguage] = useState<LanguageKey>(defaultLanguage);
  const { t } = useI18n();
  const [kind, setKind] = useState(initialKind ?? "image");
  // Each kind keeps its own tier, starting at its default, or at the best
  // tier the balance still covers.
  const [qualities, setQualities] = useState<Record<"image" | "video", Quality>>(() => ({
    image: affordable(DEFAULT_IMAGE_QUALITY, imageRunCost, credits),
    video: affordable(DEFAULT_VIDEO_QUALITY, (q) => videoRunCost(DEFAULT_VIDEO_OPTIONS.length, q), credits),
  }));
  const quality = qualities[kind];
  const [ideas, setIdeas] = useState<IdeaCount>(ADS_PER_GENERATION);
  const example = examples?.[kind][quality] ?? null;

  const segment = "flex min-h-11 cursor-pointer flex-col justify-center border-line-strong px-3 py-1 text-center not-last:border-e has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:ring-2 has-focus-visible:ring-accent";
  const row = "flex flex-wrap items-center gap-x-3 gap-y-1.5 lg:justify-end";
  const label = "w-full text-sm text-muted sm:w-auto";

  return (
    <div className="flex flex-col items-start gap-3 text-sm lg:items-end">
      <div role="group" aria-label={t.app.kind} className="inline-flex overflow-hidden rounded-lg border border-line-strong">
        {(["image", "video"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}
            className={"min-h-11 border-line-strong px-4 font-medium not-last:border-e " + (kind === value ? "bg-accent-soft text-accent" : "hover:text-accent")}>
            {value === "image" ? t.app.kindImages : t.app.kindVideos}
            {value === "image" && freeTrial && <span className="ms-2 text-xs font-normal">{t.onboard.recommended}</span>}
          </button>
        ))}
      </div>
      {kind === "image" && (
        <fieldset data-ideas className={row}>
          <legend className="sr-only">{t.app.howMany}</legend>
          <span aria-hidden className={label} title={t.app.ideasHelp}>{t.app.howMany}</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-line-strong" title={t.app.ideasHelp}>
            {IDEA_COUNTS.map((count) => (
              <label key={count} className={segment + " min-w-14 font-medium"}>
                <input type="radio" name="ideas" value={count} checked={ideas === count} onChange={() => setIdeas(count)} className="sr-only" />
                {count * ASPECTS.length}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset data-quality className={row}>
        <legend className="sr-only">{t.app.quality}</legend>
        <span aria-hidden className={label} title={t.app.qualityHelp}>{t.app.quality}</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-line-strong" title={t.app.qualityHelp}>
          {QUALITIES.map((tier) => (
            <label key={tier} className={segment}>
              <input
                type="radio"
                name={`quality-${kind}`}
                value={tier}
                checked={quality === tier}
                onChange={() => setQualities((q) => ({ ...q, [kind]: tier }))}
                className="peer sr-only"
              />
              <span className="font-medium">{t.app.qualities[tier]}</span>
              <span className="text-[11px] leading-tight text-muted peer-checked:text-accent/80">
                {fmt(t.app.credits, { count: kind === "image" ? imageRunCost(tier, ideas) : videoRunCost(DEFAULT_VIDEO_OPTIONS.length, tier) })}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {example && (
        <a data-quality-example href={kind === "image" ? `/api/creatives/${example}/image?layout=face-aware-v2` : `/api/creatives/${example}/video`}
          target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-line p-2 pe-3 text-xs text-muted transition hover:border-accent hover:text-accent lg:flex-row-reverse">
          {kind === "image"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img key={example} src={`/api/creatives/${example}/image?layout=face-aware-v2&preview=1`} alt="" width={72} height={72} className="size-18 rounded-lg bg-surface object-cover" />
            : <video key={example} src={`/api/creatives/${example}/video`} muted loop autoPlay playsInline preload="metadata" className="h-24 w-14 rounded-lg bg-surface object-cover" />}
          <span>{t.app.qualityExample} · {t.app.qualities[quality]}</span>
        </a>
      )}
      <div className="flex flex-wrap items-start gap-2 lg:justify-end">
        <label className="relative flex min-h-11 items-center" title={t.app.adLanguage}>
          <span className="sr-only">{t.app.adLanguage}</span>
          <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute start-3 size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7.5" /><path d="M2.5 10h15M10 2.5c2.2 2.4 2.2 12.6 0 15M10 2.5c-2.2 2.4-2.2 12.6 0 15" /></svg>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageKey)}
            className="min-h-11 min-w-0 max-w-48 rounded-xl border border-line-strong bg-raised py-2 ps-9 pe-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
          >
            {(Object.keys(LANGUAGES) as LanguageKey[]).map((key) => (
              <option key={key} value={key}>
                {languageOption(key)}
              </option>
            ))}
          </select>
        </label>
        {kind === "image" && <GenerateButton
          initialRequestId={imageRequestId}
          productId={productId}
          cost={imageRunCost(quality, ideas)}
          ideas={ideas}
          credits={credits}
          language={language}
          quality={quality}
        />}
        {kind === "video" && <VideoAdForm
          initiallyOpen
          credits={credits}
          initialRequestId={videoRequestId}
          productId={productId}
          label={videoLabel}
          language={language}
          quality={quality}
        />}
      </div>
    </div>
  );
}

// The default tier, or the highest cheaper tier that fits the balance.
function affordable(preferred: Quality, cost: (q: Quality) => number, credits?: number): Quality {
  if (credits === undefined || cost(preferred) <= credits) return preferred;
  const cheaper = QUALITIES.slice(0, QUALITIES.indexOf(preferred)).reverse();
  return cheaper.find((q) => cost(q) <= credits) ?? preferred;
}
