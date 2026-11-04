"use client";
import { useActionState } from "react";
import { grantCredits, type GrantState } from "./actions";

const initial: GrantState = { error: null, done: null };

export function GrantForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(grantCredits, initial);
  const field = "min-h-11 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent";
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="grant-amount">Credits</label>
        <input id="grant-amount" name="amount" type="number" inputMode="numeric" step={1} min={-100000} max={100000} required placeholder="Credits, e.g. 100" className={`${field} sm:w-44`} />
        <label className="sr-only" htmlFor="grant-note">Reason</label>
        <input id="grant-note" name="note" type="text" maxLength={200} placeholder="Reason (optional), e.g. Refund for failed video" className={`${field} min-w-0 flex-1`} />
        <button type="submit" disabled={pending} className="btn-primary min-h-11 rounded-xl px-4 text-sm font-medium">
          {pending ? "Saving…" : "Grant credits"}
        </button>
      </div>
      <p className="text-xs text-muted">Use a minus sign to take credits away, e.g. -50. Every change is logged below.</p>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.done && <p role="status" className="text-sm text-ok">{state.done}</p>}
    </form>
  );
}
