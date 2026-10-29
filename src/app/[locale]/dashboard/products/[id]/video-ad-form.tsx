"use client";

import { useActionState, useState } from "react";
import { startGeneration, type FormState } from "../../actions";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import {
  ACCENTS,
  DEFAULT_VIDEO_OPTIONS,
  ENERGIES,
  GENDERS,
  MAX_MESSAGE_LENGTH,
  PEOPLE,
} from "@/lib/video-options";

const initialState: FormState = { error: null };

const field =
  "w-full rounded-md border border-line-strong bg-raised px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20";

// The video button opens a short form for what the ad says and who says it.
export function VideoAdForm({
  productId,
  cost,
  label,
  language,
}: {
  productId: string;
  cost: number;
  label: string;
  // Chosen next to the buttons; shared with image runs.
  language: string;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const [state, action, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await startGeneration(prev, formData);
      if (!result.error) setOpen(false);
      return result;
    },
    initialState,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-line-strong bg-raised px-4 py-2.5 font-medium transition hover:border-accent hover:text-accent"
      >
        {fmt(t.app.withCost, { label, cost })}
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-4 rounded-xl border border-line bg-raised p-4 text-left text-sm sm:w-96"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="kind" value="video" />

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
        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-line-strong">
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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-lg px-4 py-2 font-medium"
        >
          {pending ? t.app.starting : fmt(t.app.withCost, { label, cost })}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted underline underline-offset-4"
        >
          {t.app.cancel}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
