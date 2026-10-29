// Languages an ad can be written and spoken in. Shared by forms (browser)
// and the pipeline (server), so it stays free of server imports.
// `code` is the ISO 639-1 code the voice model takes; `script` tells the ad
// renderer which fonts and text shaping the copy needs.

export const LANGUAGES = {
  english: { label: "English", native: "English", code: "en", script: "latin" },
  spanish: { label: "Spanish", native: "Español", code: "es", script: "latin" },
  portuguese: {
    label: "Portuguese",
    native: "Português",
    code: "pt",
    script: "latin",
  },
  french: { label: "French", native: "Français", code: "fr", script: "latin" },
  german: { label: "German", native: "Deutsch", code: "de", script: "latin" },
  italian: {
    label: "Italian",
    native: "Italiano",
    code: "it",
    script: "latin",
  },
  polish: { label: "Polish", native: "Polski", code: "pl", script: "latin" },
  dutch: { label: "Dutch", native: "Nederlands", code: "nl", script: "latin" },
  swedish: { label: "Swedish", native: "Svenska", code: "sv", script: "latin" },
  turkish: { label: "Turkish", native: "Türkçe", code: "tr", script: "latin" },
  romanian: {
    label: "Romanian",
    native: "Română",
    code: "ro",
    script: "latin",
  },
  czech: { label: "Czech", native: "Čeština", code: "cs", script: "latin" },
  japanese: {
    label: "Japanese",
    native: "日本語",
    code: "ja",
    script: "japanese",
  },
  korean: { label: "Korean", native: "한국어", code: "ko", script: "korean" },
  chinese: {
    label: "Chinese (Simplified)",
    native: "简体中文",
    code: "zh",
    script: "chinese",
  },
  hindi: { label: "Hindi", native: "हिन्दी", code: "hi", script: "devanagari" },
  arabic: { label: "Arabic", native: "العربية", code: "ar", script: "arabic" },
} as const;

export type LanguageKey = keyof typeof LANGUAGES;

export const DEFAULT_LANGUAGE: LanguageKey = "english";

export function isLanguageKey(value: unknown): value is LanguageKey {
  return typeof value === "string" && value in LANGUAGES;
}

// "English", or "Español (Spanish)": what a language picker shows.
export function languageOption(key: LanguageKey) {
  const l = LANGUAGES[key];
  return l.native === l.label ? l.label : `${l.native} (${l.label})`;
}
