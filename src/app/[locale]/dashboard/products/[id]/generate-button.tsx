"use client";

import { useGenerationAction } from "./use-generation-action";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

export function GenerateButton({
  productId,
  initialRequestId,
  cost,
  language,
}: {
  productId: string;
  initialRequestId: string;
  cost: number;
  language: string;
}) {
  const { state, action, pending, requestId } = useGenerationAction(initialRequestId);
  const { t } = useI18n();

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="language" value={language} />
      <button
        type="submit"
        disabled={pending}
        className="btn-primary rounded-xl px-4 py-2.5 font-medium"
      >
        {pending ? t.app.starting : fmt(t.app.generateImages, { cost })}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
