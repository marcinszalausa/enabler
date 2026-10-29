// Server code only (reads fonts, runs a native module).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import type { AdText, TextStyle } from "@/lib/ad-layout";

// Ad copy in any language. Satori draws Latin, Cyrillic, Japanese, Korean
// and Chinese well once it has a font with the glyphs, but it can't shape
// Hindi (conjuncts) or lay out Arabic right to left. Copy in those scripts
// is drawn with Skia instead, which shapes text properly, and placed in the
// ad as an image.

type Script =
  | "latin"
  | "japanese"
  | "korean"
  | "chinese"
  | "devanagari"
  | "arabic";

export function scriptOf(text: string): Script {
  if (/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text)) return "arabic";
  if (/[ऀ-ॿ]/.test(text)) return "devanagari";
  if (/[가-힯ᄀ-ᇿ㄰-㆏]/.test(text)) return "korean";
  if (/[぀-ヿ]/.test(text)) return "japanese";
  if (/[一-鿿㐀-䶿]/.test(text)) return "chinese";
  return "latin";
}

export function isRtl(texts: string[]) {
  return texts.some((t) => scriptOf(t) === "arabic");
}

// Fonts for the scripts Satori can draw. These families are large, so only
// the glyphs the copy uses are fetched from Google Fonts.
const CJK_FAMILIES = {
  japanese: "Noto Sans JP",
  korean: "Noto Sans KR",
  chinese: "Noto Sans SC",
} as const;

type SatoriFont = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight: 700;
  style: "normal";
};

const subsetCache = new Map<string, Promise<Buffer | null>>();

async function fetchSubset(family: string, text: string) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@700&text=${encodeURIComponent(text)}`,
    { signal: AbortSignal.timeout(10_000) },
  ).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))));
  const url = css.match(
    /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/,
  )?.[1];
  if (!url) throw new Error("no font file in Google Fonts CSS");
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function subset(family: string, text: string): Promise<Buffer | null> {
  const key = `${family}|${text}`;
  let font = subsetCache.get(key);
  if (!font) {
    font = fetchSubset(family, text).catch((err) => {
      console.error("font subset failed", family, err);
      subsetCache.delete(key);
      return null;
    });
    if (subsetCache.size > 500) subsetCache.clear();
    subsetCache.set(key, font);
  }
  return font;
}

// Extra fonts Satori needs for the copy, after the brand font. Satori falls
// back to them for glyphs the brand font lacks.
export async function fontsFor(texts: string[]): Promise<SatoriFont[]> {
  const byFamily = new Map<string, string>();
  for (const text of texts) {
    const script = scriptOf(text);
    if (script in CJK_FAMILIES) {
      const family = CJK_FAMILIES[script as keyof typeof CJK_FAMILIES];
      byFamily.set(family, (byFamily.get(family) ?? "") + text);
    }
  }
  const fonts = await Promise.all(
    [...byFamily].map(async ([family, text]) => {
      const chars = [...new Set(text)].sort().join("");
      const data = await subset(family, chars);
      return data
        ? { name: family, data, weight: 700 as const, style: "normal" as const }
        : null;
    }),
  );
  return fonts.filter((f) => f !== null);
}

// Scripts Skia draws, with the bundled font for each.
const SHAPED = {
  devanagari: {
    family: "Gooidy Devanagari",
    file: "NotoSansDevanagari-Bold.ttf",
  },
  arabic: { family: "Gooidy Arabic", file: "NotoSansArabic-Bold.ttf" },
} as const;

let shapedFonts: Promise<void> | null = null;

function registerShapedFonts() {
  shapedFonts ??= Promise.all(
    Object.values(SHAPED).map(async (f) => {
      const data = await readFile(join(process.cwd(), "src/fonts", f.file));
      GlobalFonts.register(data, f.family);
    }),
  ).then(() => undefined);
  return shapedFonts;
}

const BRAND_FAMILY = "Gooidy Brand";
const brandFonts = new Map<string, string>();

// The brand font, for Latin words and digits inside Hindi or Arabic copy.
function registerBrandFont(name: string, data: Buffer) {
  let family = brandFonts.get(name);
  if (!family) {
    family = `${BRAND_FAMILY} ${brandFonts.size}`;
    GlobalFonts.register(data, family);
    brandFonts.set(name, family);
  }
  return family;
}

// Copy ready for an ad layout: the text itself when Satori can draw it,
// otherwise an image of it, wrapped to the style's width.
export async function prepareText(
  text: string,
  style: TextStyle,
  brand: { name: string; data: Buffer },
): Promise<AdText> {
  const script = scriptOf(text);
  if (script !== "devanagari" && script !== "arabic") return text;
  await registerShapedFonts();
  const brandFamily = registerBrandFont(brand.name, brand.data);
  const rtl = script === "arabic";
  const font = `bold ${style.fontSize}px "${SHAPED[script].family}", "${brandFamily}"`;

  const measure = createCanvas(1, 1).getContext("2d");
  measure.font = font;
  const lines = wrap(text, style.maxWidth, (s) => measure.measureText(s).width);
  const lineHeight = Math.round(style.fontSize * style.lineHeight);
  // Room for the glow, and for marks above and below the line.
  const pad = Math.round(style.fontSize * 0.3);
  const width = Math.ceil(
    Math.min(
      style.maxWidth,
      Math.max(...lines.map((l) => measure.measureText(l).width)),
    ),
  );
  const height = lines.length * lineHeight;

  const canvas = createCanvas(width + pad * 2, height + pad * 2);
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.fillStyle = style.color;
  ctx.textBaseline = "middle";
  ctx.direction = rtl ? "rtl" : "ltr";
  if (style.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 2;
  }
  const x =
    style.align === "center" ? pad + width / 2 : rtl ? pad + width : pad;
  ctx.textAlign = style.align === "center" ? "center" : rtl ? "right" : "left";
  lines.forEach((line, i) =>
    ctx.fillText(line, x, pad + i * lineHeight + lineHeight / 2),
  );

  return {
    src: `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`,
    width: width + pad * 2,
    height: height + pad * 2,
    // The image's padding, so layouts can line its text up with the edge.
    pad,
  };
}

// Greedy word wrap; a word longer than the line gets a line of its own.
function wrap(text: string, maxWidth: number, width: (s: string) => number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
