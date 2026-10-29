"use client";

import { useActionState, useState } from "react";
import { saveBrandKit, type BrandFormState } from "./actions";

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

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="logo" className="text-sm font-medium">
          Logo
        </label>
        {logoUrl && (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
            <img
              src={logoUrl}
              alt="Current logo"
              className="h-16 max-w-48 rounded-md bg-white object-contain p-2"
            />
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <input type="checkbox" name="remove_logo" /> Remove logo
            </label>
          </div>
        )}
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-200 file:px-3 file:py-2 dark:file:bg-neutral-800"
        />
        <p className="text-xs text-neutral-500">
          PNG or JPEG, under 2 MB. A transparent PNG looks best.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="accent_color" className="text-sm font-medium">
          Button color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="accent_color"
            name="accent_color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-md border border-neutral-300 bg-transparent dark:border-neutral-700"
          />
          <span className="font-mono text-sm text-neutral-500">{color}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="font" className="text-sm font-medium">
          Headline font
        </label>
        <select
          id="font"
          name="font"
          defaultValue={font}
          className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
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
          className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : "Save brand kit"}
        </button>
        {state.saved && !pending && (
          <p className="text-sm text-green-600">Saved. Your ads now use it.</p>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
