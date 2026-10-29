"use client";

import { useI18n } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";

// A line of app text for server pages that can't read their language
// before their dynamic data (the product page renders before its id is
// known, so its frame takes the language from the layout's provider).
export function AppText({ k }: { k: keyof Messages["app"] }) {
  const value = useI18n().t.app[k];
  return typeof value === "string" ? value : null;
}
