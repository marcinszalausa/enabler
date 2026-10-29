import type { ReactNode } from "react";
import { Nav, Footer } from "./chrome";

// Where people reach us about their data or these terms.
export const CONTACT_EMAIL = "hello@gooidy.com";

// A plain reading page for the privacy policy and terms.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <Nav />
      <main className="flex-1">
        <article className="legal mx-auto max-w-2xl px-4 pb-24 pt-14 sm:pt-20">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted">Last updated {updated}</p>
          <div className="mt-10">{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
