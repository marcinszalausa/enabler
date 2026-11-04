"use client";

import { useState } from "react";
import { LANGUAGES, languageOption, type LanguageKey } from "@/lib/languages";
import { useI18n } from "@/i18n/client";
import { GenerateButton } from "./generate-button";
import { VideoAdForm } from "./video-ad-form";
import { fmt } from "@/i18n/format";
import { imageRunCost } from "@/lib/image-pricing";
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
  const example = examples?.[kind][quality] ?? null;

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      {<div className="flex flex-wrap gap-2">{(["image","video"] as const).map(value => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={"min-h-11 rounded-lg border px-3 text-sm " + (kind === value ? "border-accent bg-accent-soft text-accent" : "border-line")}>{value === "image" ? t.app.imageAds.replace("{count}", "10") : t.app.videoAds.replace("{count}", "2")}{value === "image" && freeTrial && <span className="ms-2 text-xs">{t.onboard.recommended}</span>}</button>)}</div>}
      <fieldset data-quality className="flex max-w-full flex-col gap-1.5 text-sm lg:items-end">
        <legend className="sr-only">{t.app.quality}</legend>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span aria-hidden className="text-muted">{t.app.quality}</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-line-strong">
            {QUALITIES.map((tier) => (
              <label
                key={tier}
                className="flex min-h-11 cursor-pointer flex-col justify-center border-line-strong px-3 py-1 text-center not-last:border-e has-checked:bg-accent-soft has-checked:text-accent"
              >
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
                  {fmt(t.app.credits, { count: kind === "image" ? imageRunCost(tier) : videoRunCost(DEFAULT_VIDEO_OPTIONS.length, tier) })}
                </span>
              </label>
            ))}
          </div>
        </div>
        <span className="max-w-sm text-xs text-muted lg:text-end">{t.app.qualityHelp}</span>
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
      </fieldset>
      <label className="flex max-w-full flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{t.app.adLanguage}</span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageKey)}
          className="min-w-0 max-w-full rounded-lg border border-line-strong bg-raised px-2.5 py-1.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
        >
          {(Object.keys(LANGUAGES) as LanguageKey[]).map((key) => (
            <option key={key} value={key}>
              {languageOption(key)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-start gap-2 lg:justify-end">
        {kind === "image" && <GenerateButton
          initialRequestId={imageRequestId}
          productId={productId}
          cost={imageRunCost(quality)}
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

