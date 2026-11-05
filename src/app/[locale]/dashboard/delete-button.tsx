"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { deleteAdAction, deleteProductAction, type DeleteState } from "./delete-actions";

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

// A quiet "Delete" button that asks once, in a dialog, before anything is removed.
export function DeleteButton({
  target,
  id,
  onDeleted,
  className,
}: {
  target: "ad" | "product";
  id: string;
  onDeleted?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-delete={target}
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-muted transition hover:text-danger"}
      >
        <TrashIcon />
        {target === "ad" ? t.remove.deleteAd : t.remove.deleteProduct}
      </button>
      {open && <DeleteDialog target={target} id={id} onClose={() => setOpen(false)} onDeleted={onDeleted} />}
    </>
  );
}

// The confirm step. Mounted only while asked for: a grid of cards stays
// light, and other dialogs on the page stay the only ones.
export function DeleteDialog({
  target,
  id,
  onClose,
  onDeleted,
}: {
  target: "ad" | "product";
  id: string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useI18n();
  const r = t.remove;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    target === "ad" ? deleteAdAction : deleteProductAction,
    { error: null, done: false },
  );
  const after = useRef(onDeleted);
  useEffect(() => { after.current = onDeleted; });
  // Runs once per finished delete: the state object changes only then.
  useEffect(() => {
    if (state.done) {
      dialog.current?.close();
      after.current?.();
    }
  }, [state]);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby={`delete-${id}`}
      onClick={(e) => { if (e.target === dialog.current && !pending) dialog.current.close(); }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-bg p-5 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:p-6"
    >
      <form action={action}>
        <input type="hidden" name={target === "ad" ? "creativeId" : "productId"} value={id} />
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-bg text-danger" aria-hidden>
          <TrashIcon />
        </span>
        <h2 id={`delete-${id}`} className="mt-4 text-lg font-semibold">
          {target === "ad" ? r.adTitle : r.productTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {target === "ad" ? r.adBody : r.productBody}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{r.history}</p>
        {state.error && <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" autoFocus disabled={pending} onClick={() => dialog.current?.close()} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium hover:bg-surface">
            {r.keep}
          </button>
          <button type="submit" data-delete-confirm disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-danger px-4 text-sm font-medium text-bg disabled:opacity-60">
            {pending ? r.deleting : r.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
