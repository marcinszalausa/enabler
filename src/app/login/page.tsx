import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AppBar } from "../_landing/chrome";

export const metadata = { title: "Sign in · Gooidy" };

export default function LoginPage() {
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <AppBar />
      <main className="hero-bg flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-raised p-8 shadow-[0_24px_60px_-30px_rgb(var(--t-shadow)/0.35)]">
          <h1 className="text-2xl font-semibold">Sign in to Gooidy</h1>
          <p className="mt-2 text-sm text-muted">
            We&apos;ll email you a magic link. No password needed.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
