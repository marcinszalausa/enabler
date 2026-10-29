// Choices the owner makes for a video run. Shared by the form (browser)
// and the pipeline (server), so it stays free of server imports.

export const LANGUAGES = {
  english: { label: "English", code: "en" },
  polish: { label: "Polish", code: "pl" },
  german: { label: "German", code: "de" },
  french: { label: "French", code: "fr" },
  spanish: { label: "Spanish", code: "es" },
  italian: { label: "Italian", code: "it" },
} as const;

export const GENDERS = {
  female: { label: "Female" },
  male: { label: "Male" },
} as const;

// English with each accent (other languages are spoken natively). Native accents use a voice recorded with it;
// the rest ask the voice model for the accent with an audio tag.
export const ACCENTS = {
  american: { label: "American", voices: ["Sarah", "Brian"], tag: null },
  british: { label: "British", voices: ["Alice", "George"], tag: null },
  australian: {
    label: "Australian",
    voices: ["Sarah", "Charlie"],
    tag: "[Australian accent]",
  },
  french: {
    label: "French",
    voices: ["Sarah", "Brian"],
    tag: "[French accent]",
  },
  german: {
    label: "German",
    voices: ["Sarah", "Brian"],
    tag: "[German accent]",
  },
  italian: {
    label: "Italian",
    voices: ["Sarah", "Brian"],
    tag: "[Italian accent]",
  },
  spanish: {
    label: "Spanish",
    voices: ["Sarah", "Brian"],
    tag: "[Spanish accent]",
  },
  polish: {
    label: "Polish",
    voices: ["Sarah", "Brian"],
    tag: "[Polish accent]",
  },
  indian: {
    label: "Indian",
    voices: ["Sarah", "Brian"],
    tag: "[Indian accent]",
  },
  chinese: {
    label: "Chinese",
    voices: ["Sarah", "Brian"],
    tag: "[Chinese accent]",
  },
  japanese: {
    label: "Japanese",
    voices: ["Sarah", "Brian"],
    tag: "[Japanese accent]",
  },
  korean: {
    label: "Korean",
    voices: ["Sarah", "Brian"],
    tag: "[Korean accent]",
  },
  filipino: {
    label: "Filipino",
    voices: ["Sarah", "Brian"],
    tag: "[Filipino accent]",
  },
} as const;

export const ENERGIES = {
  calm: {
    label: "Calm",
    // Delivery tag for the voice model (ElevenLabs v3 audio tags).
    tag: "[calm]",
    direction: "calm, soothing and unhurried; slow, warm music",
  },
  upbeat: {
    label: "Upbeat",
    tag: "[cheerfully]",
    direction: "warm, upbeat and friendly; light, bouncy music",
  },
  high: {
    label: "High energy",
    tag: "[excited]",
    direction: "high-energy, punchy and excited; fast, driving music",
  },
} as const;

export const PEOPLE = {
  auto: { label: "Best fit for the audience", direction: null },
  "woman-20s": { label: "Woman, 20s", direction: "a woman in her 20s" },
  "woman-30s": {
    label: "Woman, 30s–40s",
    direction: "a woman in her 30s or 40s",
  },
  "woman-50s": { label: "Woman, 50+", direction: "a woman in her 50s or 60s" },
  "man-20s": { label: "Man, 20s", direction: "a man in his 20s" },
  "man-30s": { label: "Man, 30s–40s", direction: "a man in his 30s or 40s" },
  "man-50s": { label: "Man, 50+", direction: "a man in his 50s or 60s" },
  product: {
    label: "No person, product only",
    direction:
      "no person at all; the product alone, styled in a setting (folded, hanging, laid flat, on a chair)",
  },
} as const;

export type LanguageKey = keyof typeof LANGUAGES;
export type GenderKey = keyof typeof GENDERS;
export type AccentKey = keyof typeof ACCENTS;
export type EnergyKey = keyof typeof ENERGIES;
export type PersonKey = keyof typeof PEOPLE;

export type VideoOptions = {
  // What the owner wants the voiceover to say; may be empty.
  message: string;
  language: LanguageKey;
  gender: GenderKey;
  accent: AccentKey;
  energy: EnergyKey;
  person: PersonKey;
};

export const MAX_MESSAGE_LENGTH = 300;

export const DEFAULT_VIDEO_OPTIONS: VideoOptions = {
  message: "",
  language: "english",
  gender: "female",
  accent: "american",
  energy: "upbeat",
  person: "auto",
};

export function parseVideoOptions(form: FormData): VideoOptions {
  const pick = <T extends object>(
    value: FormDataEntryValue | null,
    choices: T,
    fallback: keyof T,
  ) =>
    (typeof value === "string" && value in choices
      ? value
      : fallback) as keyof T;
  return {
    message: String(form.get("message") ?? "")
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH),
    language: pick(
      form.get("language"),
      LANGUAGES,
      DEFAULT_VIDEO_OPTIONS.language,
    ),
    gender: pick(form.get("gender"), GENDERS, DEFAULT_VIDEO_OPTIONS.gender),
    accent: pick(form.get("accent"), ACCENTS, DEFAULT_VIDEO_OPTIONS.accent),
    energy: pick(form.get("energy"), ENERGIES, DEFAULT_VIDEO_OPTIONS.energy),
    person: pick(form.get("person"), PEOPLE, DEFAULT_VIDEO_OPTIONS.person),
  };
}

// The ElevenLabs voice and delivery tags for the chosen options.
export function voiceFor(options: VideoOptions) {
  const accent = ACCENTS[isEnglish(options) ? options.accent : "american"];
  return {
    name: accent.voices[options.gender === "female" ? 0 : 1],
    tag: [accent.tag, ENERGIES[options.energy].tag].filter(Boolean).join(" "),
    languageCode: LANGUAGES[options.language].code,
  };
}

export function isEnglish(options: Pick<VideoOptions, "language">) {
  return options.language === "english";
}
