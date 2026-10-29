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
        className="btn-primary rounded-lg px-4 py-2 font-medium"
      >
        {pending ? "Starting…" : `Generate 5 image ads (${cost} credits)`}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
