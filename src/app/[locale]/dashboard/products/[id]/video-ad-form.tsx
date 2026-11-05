"use client";

import { useState } from "react";
import { useGenerationAction } from "./use-generation-action";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import {
  ACCENTS,
  DEFAULT_VIDEO_OPTIONS,
  ENERGIES,
  GENDERS,
  LENGTHS,
  MAX_MESSAGE_LENGTH,
  PEOPLE,
  videoRunCost,
  type LengthKey,
} from "@/lib/video-options";
import type { Quality } from "@/lib/quality";

const field =
  "w-full rounded-xl border border-line-strong bg-raised px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20";

// Video choices: length, what the ad says and who says it, inside the create card.
export function VideoAdForm({
  productId,
  campaignId,
  initialRequestId,
  label,
  language,
  quality,
  credits,
  source,
}: {
  productId: string;
  campaignId?: string;
  initialRequestId: string;
  label: string;
  // Chosen next to the buttons.
  quality: Quality;
  // Chosen next to the buttons; shared with image runs.
  language: string;
  credits?: number;
  // The picked starting photo; none means the product's first.
  source?: string;
}) {
  const [length, setLength] = useState<LengthKey>(DEFAULT_VIDEO_OPTIONS.length);
  const { t } = useI18n();
  const { state, action, pending, requestId } = useGenerationAction(initialRequestId);

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-3 text-start text-sm"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="productId" value={productId} />
      {campaignId && <input type="hidden" name="campaignId" value={campaignId}/>}
      <input type="hidden" name="kind" value="video" />
      <input type="hidden" name="quality" value={quality} />
      {source && <input type="hidden" name="source" value={source} />}

      <p className="text-sm leading-relaxed text-muted">{fmt(t.onboard.videoChoice, { count: 2, seconds: length })}</p>
      <details><summary className="min-h-11 cursor-pointer content-center font-medium text-accent">{t.onboard.advanced}</summary><div className="flex flex-col gap-4 pt-2">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">{t.app.message}</span>
        <textarea
          name="message"
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={t.app.messagePlaceholder}
          className={field}
        />
        <span className="text-xs text-muted">{t.app.messageHelp}</span>
      </label>

      <input type="hidden" name="language" value={language} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">{t.app.length}</legend>
        <div className="grid grid-cols-5 overflow-hidden rounded-xl border border-line-strong">
          {(Object.keys(LENGTHS) as LengthKey[]).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer flex-col items-center gap-0.5 border-line-strong px-1 py-2 text-center not-last:border-r has-checked:bg-accent-soft has-checked:text-accent"
            >
              <input
                type="radio"
                name="length"
                value={key}
                checked={key === length}
                onChange={() => setLength(key)}
                className="peer sr-only"
              />
              <span className="font-medium">{key} s</span>
              <span className="text-[11px] leading-tight text-muted peer-checked:text-accent/80">
                {fmt(t.app.credits, { count: videoRunCost(key, quality) })}
              </span>
            </label>
          ))}
        </div>
        <span className="text-xs text-muted">{t.app.lengthHelp}</span>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">{t.app.voice}</span>
          <select
            name="gender"
            defaultValue={DEFAULT_VIDEO_OPTIONS.gender}
            className={field}
          >
            {(Object.keys(GENDERS) as (keyof typeof GENDERS)[]).map((key) => (
              <option key={key} value={key}>
                {t.app.genders[key]}
              </option>
            ))}
          </select>
        </label>
        {/* Accents apply to English; other languages are spoken natively. */}
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">{t.app.accent}</span>
          <select
            name="accent"
            defaultValue={DEFAULT_VIDEO_OPTIONS.accent}
            disabled={language !== "english"}
            className={`${field} disabled:opacity-50`}
          >
            {language === "english" ? (
              Object.entries(ACCENTS).map(([key, a]) => (
                <option key={key} value={key}>
                  {a.label}
                </option>
              ))
            ) : (
              <option>{t.app.native}</option>
            )}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">{t.app.energy}</legend>
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-line-strong">
          {(Object.keys(ENERGIES) as (keyof typeof ENERGIES)[]).map((key) => (
            <label
              key={key}
              className="cursor-pointer border-line-strong px-2 py-2 text-center not-last:border-r has-checked:bg-accent-soft has-checked:font-medium has-checked:text-accent "
            >
              <input
                type="radio"
                name="energy"
                value={key}
                defaultChecked={key === DEFAULT_VIDEO_OPTIONS.energy}
                className="sr-only"
              />
              {t.app.energies[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">{t.app.person}</span>
        <select
          name="person"
          defaultValue={DEFAULT_VIDEO_OPTIONS.person}
          className={field}
        >
          {(Object.keys(PEOPLE) as (keyof typeof PEOPLE)[]).map((key) => (
            <option key={key} value={key}>
              {t.app.people[key]}
            </option>
          ))}
        </select>
      </label>

      </div></details>
      {credits !== undefined && <p data-video-balance role="status" className="rounded-lg bg-surface p-3 text-sm">{fmt(videoRunCost(length, quality)>credits?t.trial.notEnough:t.trial.afterVideo,{cost:videoRunCost(length, quality),remaining:Math.max(0,credits-videoRunCost(length, quality))})}</p>}
      <button
        type="submit"
        disabled={pending || (credits !== undefined && videoRunCost(length, quality)>credits)}
        className="btn-primary min-h-12 w-full rounded-xl px-6 py-3 font-semibold lg:w-auto lg:min-w-80 lg:self-start"
      >
        {pending
          ? t.app.starting
          : fmt(t.app.withCost, { label, cost: videoRunCost(length, quality) })}
      </button>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

