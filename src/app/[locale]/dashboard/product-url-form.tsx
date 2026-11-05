"use client";

import type {PaidPlanId} from "@/lib/paid-plans";
import { useActionState } from "react";
import { createProduct, type FormState } from "./actions";
import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";

const initialState: FormState = { error: null };

export function ProductUrlForm({ defaultUrl, onboardingKind, selectedPlan }: { defaultUrl: string; onboardingKind?: "image" | "video";selectedPlan?:PaidPlanId|null }) {
  const [state, action, pending] = useActionState(createProduct, initialState);
  const { t, locale } = useI18n();

  return (
    <form action={action} className="flex flex-col gap-2">
      {selectedPlan&&<input type="hidden" name="selectedPlan" value={selectedPlan}/>}
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
      <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm text-muted">
        <input type="checkbox" name="rightsConfirmed" required className="mt-1 accent-accent" />
        <span>
          {t.app.rightsConfirm}{" "}
          <Link href={localePath(locale, "/policies/acceptable-use")} target="_blank" className="underline underline-offset-4">{t.app.rightsRules}</Link>
        </span>
      </label>
      {pending && <p className="text-sm text-muted">{t.app.readingNote}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
