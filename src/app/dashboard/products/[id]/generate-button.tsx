"use client";

import { useActionState } from "react";
import { startGeneration, type FormState } from "../../actions";

const initialState: FormState = { error: null };

export function GenerateButton({
  productId,
  cost,
  kind = "image",
  label,
}: {
  productId: string;
  cost: number;
  kind?: "image" | "video";
  label: string;
}) {
  const [state, action, pending] = useActionState(
    startGeneration,
    initialState,
  );

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="kind" value={kind} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-4 py-2 font-medium disabled:opacity-60 ${
          kind === "image"
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            : "border border-neutral-300 dark:border-neutral-700"
        }`}
      >
        {pending ? "Starting…" : `${label} (${cost} credits)`}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
