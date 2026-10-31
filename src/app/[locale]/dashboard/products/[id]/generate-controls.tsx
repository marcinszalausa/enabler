"use client";

import { useState } from "react";
import { LANGUAGES, languageOption, type LanguageKey } from "@/lib/languages";
import { useI18n } from "@/i18n/client";
import { GenerateButton } from "./generate-button";
import { VideoAdForm } from "./video-ad-form";

// One language for the next run, image or video. Starts at the language the
// product page is written in.
export function GenerateControls({
  productId,
  imageRequestId,
  videoRequestId,
  imageCost,
  videoCost,
  videoLabel,
  defaultLanguage,
  initialKind,
}: {
  productId: string;
  imageRequestId: string;
  videoRequestId: string;
  imageCost: number;
  videoCost: number;
  videoLabel: string;
  defaultLanguage: LanguageKey;
  initialKind?: "image" | "video";
}) {
  const [language, setLanguage] = useState<LanguageKey>(defaultLanguage);
  const { t } = useI18n();
  const [kind, setKind] = useState(initialKind ?? "image");

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      {initialKind && <div className="flex flex-wrap gap-2">{(["image","video"] as const).map(value => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={"min-h-11 rounded-lg border px-3 text-sm " + (kind === value ? "border-accent bg-accent-soft text-accent" : "border-line")}>{value === "image" ? t.app.imageAds.replace("{count}", "10") : t.app.videoAds.replace("{count}", "2")}</button>)}</div>}
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
        {(!initialKind || kind === "image") && <GenerateButton
          initialRequestId={imageRequestId}
          productId={productId}
          cost={imageCost}
          language={language}
        />}
        {(!initialKind || kind === "video") && <VideoAdForm
          initiallyOpen={!!initialKind}
          initialRequestId={videoRequestId}
          productId={productId}
          cost={videoCost}
          label={videoLabel}
          language={language}
        />}
      </div>
    </div>
  );
}
