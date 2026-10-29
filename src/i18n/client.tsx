"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Messages } from "./messages";

// The page's language and text for client components; the layout provides
// it, server components read the same messages directly.
const I18n = createContext<{ locale: Locale; t: Messages } | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  return <I18n value={{ locale, t: messages }}>{children}</I18n>;
}

export function useI18n() {
  const value = useContext(I18n);
  if (!value) throw new Error("useI18n outside I18nProvider");
  return value;
}

// An ad angle's name and idea in the page's language.
export function useAngles() {
  const { t } = useI18n();
  return {
    name: (a: string) =>
      t.angles[a as keyof Messages["angles"]]?.name ?? a.replace("_", " "),
    idea: (a: string) => t.angles[a as keyof Messages["angles"]]?.idea ?? null,
  };
}
