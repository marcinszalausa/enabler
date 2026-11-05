"use client";

import { useActionState } from "react";
import { buildLibraryAction } from "./style-library-actions";

export function StyleLibraryButton({ made, total }: { made: number; total: number }) {
  const [state, action, pending] = useActionState(buildLibraryAction, { message: null });
  const left = total - made;
  const next = Math.min(left, 15);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center" data-style-library>
      <p className="text-sm"><span className="font-semibold">{made}</span> of {total} style images ready.</p>
      {left > 0 && (
        <button type="submit" disabled={pending} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold sm:ms-auto">
          {pending ? "Generating… (up to 3 minutes)" : `Generate ${next} images (about $${(next * 0.08).toFixed(2)})`}
        </button>
      )}
      {state.message && <p role="status" className="text-sm text-muted">{state.message}</p>}
    </form>
  );
}
