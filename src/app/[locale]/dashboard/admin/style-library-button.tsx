"use client";

import { useActionState } from "react";
import { buildAvatarLibraryAction, buildLibraryAction } from "./style-library-actions";

// Fills one of Gooidy's image libraries a batch per click.
export function StyleLibraryButton({ made, total, kind = "style" }: { made: number; total: number; kind?: "style" | "avatar" }) {
  const [state, action, pending] = useActionState(kind === "avatar" ? buildAvatarLibraryAction : buildLibraryAction, { message: null });
  const left = total - made;
  const next = Math.min(left, kind === "avatar" ? 16 : 15);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center" data-style-library={kind}>
      <p className="text-sm"><span className="font-semibold">{made}</span> of {total} {kind === "avatar" ? "avatars" : "style images"} ready.</p>
      {left > 0 && (
        <button type="submit" disabled={pending} className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold sm:ms-auto">
          {pending ? "Generating… (up to 3 minutes)" : `Generate ${next} images (about $${(next * 0.08).toFixed(2)})`}
        </button>
      )}
      {state.message && <p role="status" className="text-sm text-muted">{state.message}</p>}
    </form>
  );
}
