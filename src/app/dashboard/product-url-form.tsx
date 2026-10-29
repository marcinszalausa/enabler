"use client";

import { useActionState } from "react";
import { createProduct, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function ProductUrlForm({ defaultUrl }: { defaultUrl: string }) {
  const [state, action, pending] = useActionState(createProduct, initialState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="url" className="text-sm font-medium">
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
          className="flex-1 rounded-md border border-line-strong bg-raised px-3 py-2 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary rounded-lg px-4 py-2 font-medium"
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
