"use client";

import { useState } from "react";
import { LANGUAGES, languageOption, type LanguageKey } from "@/lib/languages";
import { useI18n } from "@/i18n/client";
import { GenerateButton } from "./generate-button";
import { VideoAdForm } from "./video-ad-form";
import { PhotoRow, type PickedPhoto } from "./image-picker";
import { StyleRow, type PickedStyle } from "./style-picker";
import { AvatarRow, type PickedAvatar } from "./avatar-picker";
import { CreateChips, type BrandSummary } from "./create-chips";
import { DEFAULT_VIDEO_OPTIONS, videoRunCost } from "@/lib/video-options";
import { DEFAULT_IMAGE_QUALITY, DEFAULT_VIDEO_QUALITY, QUALITIES, type Quality } from "@/lib/quality";
import {
  DEFAULT_FOCUS, DEFAULT_RATIO, DEFAULT_VARIATIONS, IMAGE_MODELS, VIDEO_MODELS, variationRunCost,
  type Focus, type Ratio, type VariationCount,
} from "@/lib/create-options";

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
  brand = null,
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
  // The workspace brand for the Brand DNA picker.
  brand?: BrandSummary | null;
}) {
  const [style, setStyle] = useState<PickedStyle | null>(null);
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(defaultPhoto ? { value: `product:${defaultPhoto}`, src: defaultPhoto, uploaded: false } : null);
  const [language, setLanguage] = useState<LanguageKey>(defaultLanguage);
  const { t } = useI18n();
  const [kind, setKind] = useState(initialKind ?? "image");
  const [ratio, setRatio] = useState<Ratio>(DEFAULT_RATIO);
  const [variations, setVariations] = useState<VariationCount>(DEFAULT_VARIATIONS);
  const [focus, setFocus] = useState<Focus>(DEFAULT_FOCUS);
  const [brandOn, setBrandOn] = useState(true);
  // Each kind keeps its own model tier, starting at its default, or at the
  // best tier the balance still covers.
  const [qualities, setQualities] = useState<Record<"image" | "video", Quality>>(() => ({
    image: affordable(DEFAULT_IMAGE_QUALITY, (q) => variationRunCost(q, DEFAULT_VARIATIONS), credits),
    video: affordable(DEFAULT_VIDEO_QUALITY, (q) => videoRunCost(DEFAULT_VIDEO_OPTIONS.length, q), credits),
  }));
  const quality = qualities[kind];
  const example = examples?.[kind][quality] ?? null;
  const label = "mb-1.5 block text-sm text-muted";

  const chips = (
    <div className="flex flex-col gap-2">
      <CreateChips kind={kind} quality={quality} onQuality={(q) => setQualities((all) => ({ ...all, [kind]: q }))}
        ratio={ratio} onRatio={setRatio} variations={variations} onVariations={setVariations}
        focus={focus} onFocus={setFocus} brandOn={brandOn} onBrand={setBrandOn} brand={brand} />
      {example && (
        <a data-quality-example href={kind === "image" ? `/api/creatives/${example}/image?layout=face-aware-v2` : `/api/creatives/${example}/video`}
          target="_blank" rel="noreferrer" className="flex max-w-sm items-center gap-3 rounded-xl border border-line p-2 pe-3 text-xs text-muted transition hover:border-accent hover:text-accent">
          {kind === "image"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img key={example} src={`/api/creatives/${example}/image?layout=face-aware-v2&preview=1`} alt="" width={40} height={40} className="size-10 rounded-lg bg-surface object-cover" />
            : <video key={example} src={`/api/creatives/${example}/video`} muted loop autoPlay playsInline preload="metadata" className="h-14 w-8 rounded-lg bg-surface object-cover" />}
          <span>{t.app.qualityExample} · {(kind === "image" ? IMAGE_MODELS : VIDEO_MODELS)[quality].name}</span>
        </a>
      )}
    </div>
  );

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
      <label className="block">
        <span className={label}>{t.app.adLanguage}</span>
        <span className="relative flex items-center [contain:inline-size]">
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
        cost={variationRunCost(quality, variations)}
        variations={variations}
        ratio={ratio}
        focus={variations > 1 ? focus : undefined}
        brandOff={!brandOn}
        chips={chips}
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
        brandOff={!brandOn}
        chips={chips}
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


