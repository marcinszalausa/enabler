"use client";

import { useActionState } from "react";
import { createProduct, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function ProductUrlForm({ defaultUrl }: { defaultUrl: string }) {
  const [state, action, pending] = useActionState(createProduct, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="url" className="sr-only">
        Product or website link
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          required
          defaultValue={defaultUrl}
          placeholder="https://yourstore.com/products/..."
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-4 py-3 shadow-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-xl px-6 py-3 font-medium"
        >
          {pending ? "Reading page…" : "Add product"}
        </button>
      </div>
      {pending && (
        <p className="text-sm text-muted">
          Reading the page and writing a brand brief. This takes about 20
          seconds.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
