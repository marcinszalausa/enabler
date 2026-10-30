"use client";

import Link from "next/link";
import { Nav, Footer, useHref } from "@/app/_landing/chrome";
import { useI18n } from "@/i18n/client";

export default function NotFound() {
  const { t } = useI18n();
  const href = useHref();
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <Nav />
      <main id="main-content" tabIndex={-1} className="hero-bg flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.notFound.title}
        </h1>
        <p className="mt-3 text-muted">{t.notFound.body}</p>
        <Link
          href={href("/")}
          className="btn-primary mt-8 rounded-xl px-5 py-2.5 font-medium"
        >
          {t.notFound.home}
        </Link>
      </main>
      <Footer />
    </div>
  );
}
