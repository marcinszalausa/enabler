"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
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
      <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm">
        {t.login.sent.split("{email}")[0]}
        <strong>{email}</strong>
        {t.login.sent.split("{email}")[1]}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        {t.login.email}
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl border border-line-strong bg-bg px-4 py-3 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
        placeholder={t.login.placeholder}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary rounded-xl px-4 py-3 font-medium"
      >
        {status === "sending" ? t.login.sending : t.login.send}
      </button>
      {status === "idle" && searchParams.get("error") === "link" && (
        <p role="alert" className="text-sm text-danger">
          {t.login.linkError}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </form>
  );
}
