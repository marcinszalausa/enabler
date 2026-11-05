"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import {
  cancelPlan,
  turnOffAutoReload,
  turnOnAutoReload,
  type BillingState,
} from "./actions";

const initialState: BillingState = { error: null };

const buttonStyle = {
  primary: "btn-primary",
  secondary: "border border-line text-fg hover:bg-surface",
  danger:
    "border border-red-600/40 text-red-700 hover:bg-red-600/10 dark:text-red-400",
};

// A button that opens a dialog, like Claude's "Buy usage credits". Opens by
// itself when the page address ends in #<hash> (e.g. from "Buy more credits"
// links elsewhere in the app).
export function Modal({
  label,
  badge,
  title,
  closeLabel,
  hash,
  variant = "secondary",
  children,
}: {
  label: string;
  badge?: string;
  title: string;
  closeLabel: string;
  hash?: string;
  variant?: keyof typeof buttonStyle;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (hash && window.location.hash === `#${hash}`) ref.current?.showModal();
  }, [hash]);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${buttonStyle[variant]}`}
      >
        {label}
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              variant === "primary"
                ? "bg-white/20 text-white"
                : "bg-accent-soft text-accent"
            }`}
          >
            {badge}
          </span>
        )}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        onClick={(event) => {
          if (event.target === ref.current) ref.current.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/50"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => ref.current?.close()}
              className="-me-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-muted hover:bg-surface hover:text-fg"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}

// The auto-reload settings: below which balance, and which pack to buy.
export function AutoReloadForm({
  thresholds,
  packs,
  defaultThreshold,
  defaultPack,
  thresholdLabel,
  packLabel,
  note,
  saveLabel,
  pendingLabel,
  disabled,
}: {
  thresholds: { value: number; label: string }[];
  packs: { value: string; label: string }[];
  defaultThreshold: number;
  defaultPack: string;
  thresholdLabel: string;
  packLabel: string;
  note: string;
  saveLabel: string;
  pendingLabel: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    turnOnAutoReload,
    initialState,
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.saved) form.current?.closest("dialog")?.close();
  }, [state]);
  const field =
    "mt-1.5 min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-sm";
  return (
    <form ref={form} action={action} className="mt-5 flex flex-col gap-4">
      <label className="text-sm font-medium">
        {thresholdLabel}
        <select
          name="threshold"
          defaultValue={defaultThreshold}
          className={field}
        >
          {thresholds.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        {packLabel}
        <select name="pack" defaultValue={defaultPack} className={field}>
          {packs.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm leading-relaxed text-muted">{note}</p>
      <button
        type="submit"
        disabled={pending || disabled}
        className="btn-primary min-h-11 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? pendingLabel : saveLabel}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

// A one-click button for a billing action without inputs.
function ActionButton({
  run,
  label,
  pendingLabel,
  variant,
}: {
  run: () => Promise<BillingState>;
  label: string;
  pendingLabel: string;
  variant: keyof typeof buttonStyle;
}) {
  const [state, action, pending] = useActionState(run, initialState);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <button
        type="submit"
        disabled={pending}
        className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${buttonStyle[variant]}`}
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

export function TurnOffButton(props: { label: string; pendingLabel: string }) {
  return (
    <ActionButton run={turnOffAutoReload} variant="secondary" {...props} />
  );
}

export function CancelPlanButton(props: {
  label: string;
  pendingLabel: string;
}) {
  return <ActionButton run={cancelPlan} variant="danger" {...props} />;
}
