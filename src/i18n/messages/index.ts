import type { Locale } from "../config";
import { en } from "./en";

// The shape every language follows: English's, with each string widened.
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : { [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof en>;

const loaders: Record<Locale, () => Promise<Messages>> = {
  en: async () => en,
  es: () => import("./es").then((m) => m.es),
  pt: () => import("./pt").then((m) => m.pt),
  fr: () => import("./fr").then((m) => m.fr),
  de: () => import("./de").then((m) => m.de),
  it: () => import("./it").then((m) => m.it),
  pl: () => import("./pl").then((m) => m.pl),
  nl: () => import("./nl").then((m) => m.nl),
  sv: () => import("./sv").then((m) => m.sv),
  tr: () => import("./tr").then((m) => m.tr),
  ro: () => import("./ro").then((m) => m.ro),
  cs: () => import("./cs").then((m) => m.cs),
  ja: () => import("./ja").then((m) => m.ja),
  ko: () => import("./ko").then((m) => m.ko),
  zh: () => import("./zh").then((m) => m.zh),
  hi: () => import("./hi").then((m) => m.hi),
  ar: () => import("./ar").then((m) => m.ar),
};

export function getMessages(locale: Locale): Promise<Messages> {
  return loaders[locale]();
}
