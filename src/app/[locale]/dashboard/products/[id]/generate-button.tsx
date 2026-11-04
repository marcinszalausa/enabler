"use client";

import { useGenerationAction } from "./use-generation-action";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { Quality } from "@/lib/quality";

export function GenerateButton({
  productId,
  initialRequestId,
  cost,
  language,
  quality,
  credits,
  ideas,
}: {
  productId: string;
  initialRequestId: string;
  cost: number;
  language: string;
  quality: Quality;
  credits?: number;
  ideas?: number;
}) {
  const { state, action, pending, requestId } = useGenerationAction(initialRequestId);
  const { t } = useI18n();

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="quality" value={quality} />
      {ideas !== undefined && <input type="hidden" name="ideas" value={ideas} />}
      <button
        type="submit"
        disabled={pending || (credits!==undefined&&credits<cost)}
        className="btn-primary min-h-11 rounded-xl px-4 py-2.5 font-medium"
      >
        {pending ? t.app.starting : fmt(t.app.withCost, { label: ideas === undefined || ideas === 5 ? t.trial.create : t.demo.create, cost })}
      </button>
      {credits!==undefined&&credits<cost&&<p className="text-sm text-muted">{fmt(t.app.errors.noCredits,{cost})}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
