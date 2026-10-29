"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const next = searchParams.get("next") ?? "/dashboard";
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo.toString() },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <p className="mt-6 rounded-md border border-line p-4 text-sm">
        Check <strong>{email}</strong> for your sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        Work email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-line-strong bg-raised px-3 py-2 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
        placeholder="you@company.com"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary rounded-lg px-3 py-2 font-medium"
      >
        {status === "sending" ? "Sending…" : "Email me a link"}
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </form>
  );
}
