"use client";

import { useActionState } from "react";
import {
  buyPack,
  openPortal,
  startCheckout,
  type BillingState,
} from "./actions";

const initialState: BillingState = { error: null };

const ACTIONS = { plan: startCheckout, pack: buyPack };

// Opens Stripe Checkout for a plan or a credit pack. Labels come worded from
// the page, in the visitor's language.
export function CheckoutButton({
  kind,
  value,
  label,
  pendingLabel,
  interval,
  primary = false,
  disabled = false,
}: {
  kind: keyof typeof ACTIONS;
  value: string;
  // Plans only: "month" or "year".
  interval?: string;
  label: string;
  pendingLabel: string;
  primary?: boolean;
  // Online payments aren't open yet; the page says so once.
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(ACTIONS[kind], initialState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name={kind} value={value} />
      {interval && <input type="hidden" name="interval" value={interval} />}
      <button
        type="submit"
        disabled={pending || disabled}
        className={`min-h-11 rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
          primary
            ? "btn-primary"
            : "border border-line text-fg hover:bg-surface"
        }`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function ManageButton({
  label,
  pendingLabel,
  secondary = false,
}: {
  label: string;
  pendingLabel: string;
  secondary?: boolean;
}) {
  const [state, action, pending] = useActionState(openPortal, initialState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className={`min-h-11 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-60 ${
          secondary
            ? "border border-line text-fg hover:bg-surface"
            : "btn-primary"
        }`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
