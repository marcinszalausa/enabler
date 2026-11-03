"use client";

import { useActionState } from "react";
import { createProduct, type FormState } from "./actions";
import { useI18n } from "@/i18n/client";

const initialState: FormState = { error: null };

export function ProductUrlForm({ defaultUrl, onboardingKind }: { defaultUrl: string; onboardingKind?: "image" | "video" }) {
  const [state, action, pending] = useActionState(createProduct, initialState);
  const { t } = useI18n();

  return (
    <form action={action} className="flex flex-col gap-2">
      {onboardingKind && <input type="hidden" name="onboardingKind" value={onboardingKind}/>}
      <label htmlFor="url" className="sr-only">
        {t.app.urlLabel}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          required
          defaultValue={defaultUrl}
          placeholder="https://yourstore.com/products/..."
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-4 py-3 shadow-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-xl px-6 py-3 font-medium"
        >
          {pending ? t.app.reading : onboardingKind ? t.onboard.prepare : t.app.addProduct}
        </button>
      </div>
      {pending && <p className="text-sm text-muted">{t.app.readingNote}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
