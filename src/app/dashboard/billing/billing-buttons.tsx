"use client";

import { useActionState } from "react";
import { openPortal, startCheckout, type BillingState } from "./actions";

const initialState: BillingState = { error: null };

export function UpgradeButton({
  plan,
  label,
  primary = false,
}: {
  plan: string;
  label: string;
  primary?: boolean;
}) {
  const [state, action, pending] = useActionState(startCheckout, initialState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="plan" value={plan} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-4 py-2 font-medium disabled:opacity-60 ${
          primary
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            : "border border-neutral-300 dark:border-neutral-700"
        }`}
      >
        {pending ? "Opening checkout…" : label}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function ManageButton() {
  const [state, action, pending] = useActionState(openPortal, initialState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Opening…" : "Manage subscription"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
