"use client";
import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { setProductFavorite, type ProductFavoriteState } from "./product-actions";

// A heart on a product card: one tap saves it, another removes it.
export function ProductFavoriteButton({ productId, favorite, className }: { productId: string; favorite: boolean; className?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<ProductFavoriteState, FormData>(setProductFavorite, { favorite, error: null });
  const label = state.favorite ? t.library.unsave : t.library.save;
  return (
    <form action={action} data-product-favorite className={className}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="favorite" value={state.favorite ? "0" : "1"} />
      <button type="submit" disabled={pending} aria-pressed={state.favorite} aria-label={label} title={state.error ?? label} className="flex h-11 w-11 items-center justify-center rounded-xl text-accent transition hover:bg-accent-soft disabled:opacity-60">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill={state.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-1 10 12 21 12 21S25 10 20 5Z" /></svg>
      </button>
      {state.error && <span role="alert" className="sr-only">{state.error}</span>}
    </form>
  );
}
