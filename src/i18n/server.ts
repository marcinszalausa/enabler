import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getMessages } from "./messages";

// The signed-in visitor's language, for server actions (which have no
// [locale] in their address).
export async function requestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function requestMessages() {
  return getMessages(await requestLocale());
}
