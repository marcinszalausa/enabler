"use client";

import { useState } from "react";
import { LANGUAGES, languageOption, type LanguageKey } from "@/lib/languages";
import { useI18n } from "@/i18n/client";
import { GenerateButton } from "./generate-button";
import { VideoAdForm } from "./video-ad-form";
import { PhotoRow, type PickedPhoto } from "./image-picker";
import { StyleRow, type PickedStyle } from "./style-picker";
import { AvatarRow, type PickedAvatar } from "./avatar-picker";
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
  campaignId,
  imageRequestId,
  videoRequestId,
  videoLabel,
  defaultLanguage,
  initialKind,
  credits,
  freeTrial = false,
  examples,
  defaultPhoto,
}: {
  productId: string;
  campaignId?: string;
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
  // The product's first store photo, the default starting photo.
  defaultPhoto?: string | null;
}) {
  const [style, setStyle] = useState<PickedStyle | null>(null);
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(defaultPhoto ? { value: `product:${defaultPhoto}`, src: defaultPhoto, uploaded: false } : null);
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

  const segment = "flex min-h-11 flex-1 cursor-pointer flex-col justify-center border-line-strong px-2 py-1.5 text-center not-last:border-e has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-accent";
  const group = "flex w-full overflow-hidden rounded-xl border border-line-strong";
  const label = "mb-1.5 block text-sm text-muted";

  return (
    <div className="flex w-full flex-col gap-4 text-sm lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5">
      <div className="lg:col-span-2">
        <div className="flex flex-col gap-2">
          <PhotoRow productId={productId} photo={photo} onPick={setPhoto} />
          {kind === "image" && <AvatarRow avatar={avatar} onPick={setAvatar} credits={credits} />}
          {kind === "image" && <StyleRow style={style} onPick={setStyle} />}
        </div>
      </div>
      <div>
      <p aria-hidden className={label + " hidden lg:block"}>{t.app.kind}</p>
      <div role="group" aria-label={t.app.kind} className="flex w-full rounded-xl bg-surface p-1">
        {(["image", "video"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}
            className={"min-h-10 flex-1 rounded-lg px-3 font-medium transition " + (kind === value ? "bg-raised text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg")}>
            {value === "image" ? t.app.kindImages : t.app.kindVideos}
            {value === "image" && freeTrial && <span className="ms-1.5 hidden text-xs font-normal text-accent sm:inline">{t.onboard.recommended}</span>}
          </button>
        ))}
      </div>
      </div>
      {kind === "image" && (
        <fieldset data-ideas>
          <legend className={label} title={t.app.ideasHelp}>{t.app.howMany}</legend>
          <div className={group} title={t.app.ideasHelp}>
            {IDEA_COUNTS.map((count) => (
              <label key={count} className={segment + " font-medium"}>
                <input type="radio" name="ideas" value={count} checked={ideas === count} onChange={() => setIdeas(count)} className="sr-only" />
                {count * ASPECTS.length}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset data-quality>
        <legend className={label} title={t.app.qualityHelp}>{t.app.quality}</legend>
        <div className={group} title={t.app.qualityHelp}>
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
        {example && (
          <a data-quality-example href={kind === "image" ? `/api/creatives/${example}/image?layout=face-aware-v2` : `/api/creatives/${example}/video`}
            target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-3 rounded-xl border border-line p-2 pe-3 text-xs text-muted transition hover:border-accent hover:text-accent">
            {kind === "image"
              // eslint-disable-next-line @next/next/no-img-element
              ? <img key={example} src={`/api/creatives/${example}/image?layout=face-aware-v2&preview=1`} alt="" width={56} height={56} className="size-14 rounded-lg bg-surface object-cover" />
              : <video key={example} src={`/api/creatives/${example}/video`} muted loop autoPlay playsInline preload="metadata" className="h-20 w-12 rounded-lg bg-surface object-cover" />}
            <span>{t.app.qualityExample} · {t.app.qualities[quality]}</span>
          </a>
        )}
      </fieldset>
      <label className="block">
        <span className={label}>{t.app.adLanguage}</span>
        <span className="relative flex items-center">
          <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute start-3 size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7.5" /><path d="M2.5 10h15M10 2.5c2.2 2.4 2.2 12.6 0 15M10 2.5c-2.2 2.4-2.2 12.6 0 15" /></svg>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageKey)}
            className="min-h-11 w-full min-w-0 rounded-xl border border-line-strong bg-raised py-2 ps-9 pe-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
          >
            {(Object.keys(LANGUAGES) as LanguageKey[]).map((key) => (
              <option key={key} value={key}>
                {languageOption(key)}
              </option>
            ))}
          </select>
        </span>
      </label>
      <div className="lg:col-span-2">
      {kind === "image" && <GenerateButton
        initialRequestId={imageRequestId}
        productId={productId}
        campaignId={campaignId}
        cost={imageRunCost(quality, ideas)}
        ideas={ideas}
        credits={credits}
        language={language}
        quality={quality}
        source={photo?.value}
        style={style?.id}
        avatar={avatar?.id}
      />}
      {kind === "video" && <VideoAdForm
        credits={credits}
        initialRequestId={videoRequestId}
        productId={productId}
        campaignId={campaignId}
        label={videoLabel}
        language={language}
        quality={quality}
        source={photo?.value}
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


