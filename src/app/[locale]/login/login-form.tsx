"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";

type Status = "idle" | "sending" | "sent" | "error";
type CodeStatus = "idle" | "verifying" | "error";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");

  const next = safeNext(searchParams.get("next"));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

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

  // The email also carries a short code: typing it here signs in on this
  // device whatever browser the email opens links in.
  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeStatus("verifying");
    const { error } = await createClient().auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      setCodeStatus("error");
    } else {
      router.replace(next);
      router.refresh();
    }
  }

  if (status === "sent") {
    return (
      <form onSubmit={onVerify} className="mt-6 flex flex-col gap-3">
        <p className="rounded-xl border border-line bg-surface p-4 text-sm">
          {t.login.sent.split("{email}")[0]}
          <strong>{email}</strong>
          {t.login.sent.split("{email}")[1]}
        </p>
        <label htmlFor="code" className="mt-2 text-sm font-medium">
          {t.login.code}
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          required
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            if (codeStatus === "error") setCodeStatus("idle");
          }}
          className="rounded-xl border border-line-strong bg-bg px-4 py-3 text-center font-mono text-xl tracking-[0.4em] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20"
          placeholder="••••••"
        />
        <button
          type="submit"
          disabled={codeStatus === "verifying" || code.length < 6}
          className="btn-primary rounded-xl px-4 py-3 font-medium"
        >
          {codeStatus === "verifying" ? t.login.verifying : t.login.verify}
        </button>
        {codeStatus === "error" && (
          <p role="alert" className="text-sm text-danger">
            {t.login.codeError}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setCode("");
            setCodeStatus("idle");
          }}
          className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {t.login.otherEmail}
        </button>
      </form>
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

// Only same-site paths, never another site.
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/dashboard";
}
