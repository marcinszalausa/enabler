import type { ReactNode } from "react";
import { Nav, Footer } from "./chrome";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";

// Where people reach us about their data or these terms.
export const CONTACT_EMAIL = "hello@gooidy.com";

// A plain reading page for the privacy policy and terms. The text itself is
// English in every language, and says so.
export async function LegalPage({
  locale,
  title,
  updated,
  children,
}: {
  locale: Locale;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const t = await getMessages(locale);
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <Nav />
      <main className="flex-1">
        <article
          lang="en"
          className="legal mx-auto max-w-2xl px-4 pb-24 pt-14 sm:pt-20"
        >
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {fmt(t.legal.updated, { date: updated })}
          </p>
          {locale !== "en" && (
            <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
              {t.legal.englishOnly}
            </p>
          )}
          <div className="mt-10">{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
