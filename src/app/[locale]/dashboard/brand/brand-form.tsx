"use client";

import { useActionState, useState } from "react";
import { saveBrandKit, type BrandFormState } from "./actions";
import { useI18n } from "@/i18n/client";

const initialState: BrandFormState = { error: null, saved: false };

export function BrandForm({
  accentColor,
  font,
  fonts,
  logoUrl,
}: {
  accentColor: string;
  font: string;
  fonts: { key: string; label: string }[];
  logoUrl: string | null;
}) {
  const [state, action, pending] = useActionState(saveBrandKit, initialState);
  const [color, setColor] = useState(accentColor);
  const { t } = useI18n();

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="logo" className="text-sm font-medium">
          {t.app.logo}
        </label>
        {logoUrl && (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
            <img
              src={logoUrl}
              alt={t.app.currentLogo}
              className="h-16 max-w-48 rounded-md bg-white object-contain p-2"
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="remove_logo" /> {t.app.removeLogo}
            </label>
          </div>
        )}
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface file:text-fg file:px-3 file:py-2"
        />
        <p className="text-xs text-muted">{t.app.logoHelp}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="accent_color" className="text-sm font-medium">
          {t.app.buttonColor}
        </label>
        <div className="flex items-center gap-3">
          <input
            id="accent_color"
            name="accent_color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-md border border-line-strong bg-transparent"
          />
          <span className="font-mono text-sm text-muted">{color}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="font" className="text-sm font-medium">
          {t.app.font}
        </label>
        <select
          id="font"
          name="font"
          defaultValue={font}
          className="rounded-md border border-line-strong bg-raised px-3 py-2 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
        >
          {fonts.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-lg px-4 py-2 font-medium"
        >
          {pending ? t.app.saving : t.app.saveKit}
        </button>
        {state.saved && !pending && (
          <p className="text-sm text-ok">{t.app.saved}</p>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
