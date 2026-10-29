"use client";

import { useActionState } from "react";
import { startGeneration, type FormState } from "../../actions";

const initialState: FormState = { error: null };

export function GenerateButton({
  productId,
  cost,
}: {
  productId: string;
  cost: number;
}) {
  const [state, action, pending] = useActionState(
    startGeneration,
    initialState,
  );

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Starting…" : `Generate 5 image ads (${cost} credits)`}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
