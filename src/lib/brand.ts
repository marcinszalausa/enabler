import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const FONTS = {
  inter: { label: "Inter (clean)", name: "Inter", file: "Inter-Bold.ttf" },
  poppins: {
    label: "Poppins (friendly)",
    name: "Poppins",
    file: "Poppins-Bold.ttf",
  },
  montserrat: {
    label: "Montserrat (bold)",
    name: "Montserrat",
    file: "Montserrat-Bold.ttf",
  },
  playfair: {
    label: "Playfair Display (elegant)",
    name: "Playfair Display",
    file: "PlayfairDisplay-Bold.ttf",
  },
} as const;
export type FontKey = keyof typeof FONTS;

export type BrandKit = {
  logo_path: string | null;
  accent_color: string;
  font: FontKey;
};

export const DEFAULT_BRAND_KIT: BrandKit = {
  logo_path: null,
  accent_color: "#ffffff",
  font: "inter",
};

export const LOGO_TYPES = ["image/png", "image/jpeg"] as const;
export const MAX_LOGO_BYTES = 2_000_000;

export function isFontKey(value: unknown): value is FontKey {
  return typeof value === "string" && value in FONTS;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

// Black or white, whichever reads better on the given background.
export function textColorOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#111111" : "#ffffff";
}

const fontCache = new Map<FontKey, Promise<Buffer>>();

export function loadFont(font: FontKey): Promise<Buffer> {
  let data = fontCache.get(font);
  if (!data) {
    data = readFile(join(process.cwd(), "src/fonts", FONTS[font].file));
    fontCache.set(font, data);
  }
  return data;
}
