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
  imageCost,
  videoCost,
  videoLabel,
  defaultLanguage,
}: {
  productId: string;
  imageCost: number;
  videoCost: number;
  videoLabel: string;
  defaultLanguage: LanguageKey;
}) {
  const [language, setLanguage] = useState<LanguageKey>(defaultLanguage);
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">{t.app.adLanguage}</span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageKey)}
          className="rounded-lg border border-line-strong bg-raised px-2.5 py-1.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
        >
          {(Object.keys(LANGUAGES) as LanguageKey[]).map((key) => (
            <option key={key} value={key}>
              {languageOption(key)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-start gap-2 lg:justify-end">
        <GenerateButton
          productId={productId}
          cost={imageCost}
          language={language}
        />
        <VideoAdForm
          productId={productId}
          cost={videoCost}
          label={videoLabel}
          language={language}
        />
      </div>
    </div>
  );
}
