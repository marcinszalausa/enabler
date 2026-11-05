"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import {
  FOCUSES, IMAGE_MODELS, MODEL_ORDER, RATIOS, RATIO_PLATFORMS, VARIATION_COUNTS, VIDEO_MODELS,
  DEFAULT_FOCUS, DEFAULT_VARIATIONS, modelCredits,
  type Focus, type ModelInfo, type Platform, type Ratio, type VariationCount,
} from "@/lib/create-options";
import { DEFAULT_IMAGE_QUALITY, DEFAULT_VIDEO_QUALITY, type Quality } from "@/lib/quality";

// The workspace's brand, as the Brand DNA picker shows it.
export type BrandSummary = {
  name: string;
  logoUrl: string | null;
  accent: string;
  products: number;
  // A logo, color or name was saved; otherwise only "set up" is offered.
  ready: boolean;
};

type Menu = "model" | "ratio" | "count" | null;

// The compact row above Generate: Brand DNA, model, size and variations.
export function CreateChips({
  kind,
  quality,
  onQuality,
  ratio,
  onRatio,
  variations,
  onVariations,
  focus,
  onFocus,
  brandOn,
  onBrand,
  brand,
}: {
  kind: "image" | "video";
  quality: Quality;
  onQuality: (q: Quality) => void;
  ratio: Ratio;
  onRatio: (r: Ratio) => void;
  variations: VariationCount;
  onVariations: (n: VariationCount) => void;
  focus: Focus;
  onFocus: (f: Focus) => void;
  brandOn: boolean;
  onBrand: (on: boolean) => void;
  brand: BrandSummary | null;
}) {
  const { t } = useI18n();
  const row = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [up, setUp] = useState(true);
  const [picking, setPicking] = useState(false);
  const models = kind === "image" ? IMAGE_MODELS : VIDEO_MODELS;
  const shownRatio = kind === "video" ? "9:16" : ratio;

  // Outside clicks and Escape close the open menu.
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!row.current?.contains(e.target as Node)) setMenu(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [menu]);

  function toggle(next: Exclude<Menu, null>, e: MouseEvent<HTMLButtonElement>) {
    if (menu === next) return setMenu(null);
    // Open upward like a composer, unless the row sits near the top.
    setUp(e.currentTarget.getBoundingClientRect().top > 440);
    setMenu(next);
  }

  const chip = "inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 text-sm font-medium text-fg transition hover:border-accent aria-expanded:border-accent aria-expanded:text-accent focus-visible:ring-2 focus-visible:ring-accent";
  const panel = `absolute start-0 z-30 w-full overflow-hidden rounded-2xl border border-line bg-raised shadow-xl ${up ? "bottom-full mb-2" : "top-full mt-2"}`;

  return (
    <div ref={row} data-create-chips className="relative flex flex-wrap items-center gap-2" role="group" aria-label={t.create.options}>
      <button type="button" role="switch" aria-checked={brandOn} data-chip="brand"
        title={t.create.brandDnaHelp}
        onClick={() => { setMenu(null); if (brandOn) onBrand(false); else setPicking(true); }}
        className={chip}>
        {t.create.brandDna}
        <span aria-hidden className={"relative h-5 w-9 shrink-0 rounded-full transition " + (brandOn ? "bg-accent" : "bg-line-strong")}>
          <span className={"absolute top-0.5 size-4 rounded-full bg-white shadow transition-all " + (brandOn ? "start-[1.125rem]" : "start-0.5")} />
        </span>
      </button>

      <button type="button" aria-haspopup="listbox" aria-expanded={menu === "model"} data-chip="model"
        onClick={(e) => toggle("model", e)} className={chip + " max-w-[10.5rem] sm:max-w-[13rem]"} title={t.create.model}>
        <ChipIcon />
        <span className="truncate">{models[quality].name}{kind === "video" && quality !== "good" ? ` ${models[quality].resolution}` : ""}</span>
      </button>

      <button type="button" aria-haspopup="listbox" aria-expanded={menu === "ratio"} data-chip="ratio"
        onClick={(e) => toggle("ratio", e)} className={chip} title={t.create.ratio}>
        <RatioIcon ratio={shownRatio} />
        <span dir="ltr">{shownRatio}</span>
      </button>

      {kind === "image" && (
        <button type="button" aria-haspopup="listbox" aria-expanded={menu === "count"} data-chip="count"
          onClick={(e) => toggle("count", e)} className={chip} title={t.create.variations}>
          <ImagesIcon />
          <span>{variations}</span>
        </button>
      )}

      {menu === "model" && (
        <div className={panel + " sm:w-[27rem]"} data-menu="model">
          <ul role="listbox" aria-label={t.create.model} className="flex flex-col gap-1 p-2">
            {MODEL_ORDER.map((tier) => {
              const m = models[tier];
              const picked = tier === quality;
              const recommended = tier === (kind === "image" ? DEFAULT_IMAGE_QUALITY : DEFAULT_VIDEO_QUALITY);
              return (
                <li key={tier} role="option" aria-selected={picked}>
                  <button type="button" onClick={() => { onQuality(tier); setMenu(null); }}
                    className={"flex w-full items-start gap-3 rounded-xl p-3 text-start transition hover:bg-surface " + (picked ? "bg-surface" : "")}>
                    <MakerMark maker={m.maker} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">{m.name}</span>
                        {recommended && <Badge>{t.create.recommended}</Badge>}
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-muted">{t.create.models[kind][tier]}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <Spec title={t.create.resolution}><ResolutionIcon />{m.resolution}</Spec>
                        <Spec title={fmt(kind === "image" ? t.create.creditsPerAd : t.create.creditsPerSecond, { count: modelCredits(kind, tier) })}>
                          <BoltIcon />{modelCredits(kind, tier)}{kind === "video" ? "/s" : ""}
                        </Spec>
                      </span>
                    </span>
                    {picked && <Check />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {menu === "ratio" && (
        <div className={panel + " sm:w-[24rem]"} data-menu="ratio">
          <p className="px-4 pt-4 pb-1 text-sm font-semibold">{t.create.ratio}</p>
          {kind === "video" && <p className="px-4 pb-1 text-xs leading-snug text-muted">{t.create.videoRatio}</p>}
          <ul role="listbox" aria-label={t.create.ratio} className="flex flex-col gap-1 p-2">
            {(kind === "video" ? (["9:16"] as const) : RATIOS).map((r) => {
              const picked = r === shownRatio;
              return (
                <li key={r} role="option" aria-selected={picked}>
                  <button type="button" onClick={() => { if (kind === "image") onRatio(r); setMenu(null); }}
                    className={"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-surface " + (picked ? "bg-surface" : "")}>
                    <span className="w-24 shrink-0">
                      <span className="flex items-center gap-2 font-semibold"><RatioIcon ratio={r} /><span dir="ltr">{r}</span></span>
                      <span className="mt-0.5 block text-xs text-muted">{r === "9:16" ? t.create.storyUse : t.create.postUse}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {RATIO_PLATFORMS[r].filter((p) => kind === "image" || p !== "snapchat").map((p) => <PlatformMark key={p} platform={p} />)}
                    </span>
                    {picked && <Check />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {menu === "count" && (
        <div className={panel + " sm:grid sm:w-[38rem] sm:grid-cols-[1.15fr_1fr]"} data-menu="count">
          <div className="p-2">
            <p className="px-2 pt-2 text-sm font-semibold">{t.create.variations}</p>
            <p className="px-2 pb-2 text-xs leading-snug text-muted">{t.create.variationsHint}</p>
            <ul role="listbox" aria-label={t.create.variations} className="flex flex-col">
              {VARIATION_COUNTS.map((n) => (
                <li key={n} role="option" aria-selected={n === variations}>
                  <button type="button" onClick={() => onVariations(n)}
                    className={"flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-sm transition hover:bg-surface " + (n === variations ? "bg-surface font-medium" : "")}>
                    <span>{n === 1 ? t.create.oneVariation : fmt(t.create.variationCount, { count: n })}</span>
                    {n === DEFAULT_VARIATIONS && <Badge>{t.create.recommended}</Badge>}
                    <span className="ms-auto">{n === variations && <Check />}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-line bg-surface p-2 sm:border-t-0 sm:border-s">
            <p className="px-2 pt-2 text-sm font-semibold">{t.create.focus}</p>
            <p className="px-2 pb-2 text-xs leading-snug text-muted">{variations === 1 ? t.create.focusOne : t.create.focusHint}</p>
            <ul role="listbox" aria-label={t.create.focus} aria-disabled={variations === 1} className="flex flex-col">
              {FOCUSES.map((f) => (
                <li key={f} role="option" aria-selected={f === focus}>
                  <button type="button" disabled={variations === 1} onClick={() => { onFocus(f); setMenu(null); }}
                    className={"flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-start text-sm transition enabled:hover:bg-raised disabled:opacity-50 " + (f === focus ? "font-medium" : "")}>
                    <span>{t.create.focuses[f]}</span>
                    {f === DEFAULT_FOCUS && <Badge>{t.create.recommended}</Badge>}
                    <span className="ms-auto">{f === focus && <Check />}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {picking && (
        <BrandPicker brand={brand} onClose={() => setPicking(false)}
          onContinue={() => { onBrand(true); setPicking(false); }} />
      )}
    </div>
  );
}

function BrandPicker({ brand, onClose, onContinue }: { brand: BrandSummary | null; onClose: () => void; onContinue: () => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(Boolean(brand?.ready));
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  const shown = brand?.ready ? brand : null;

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="brand-picker-title" data-brand-picker
      onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}
      className="m-auto max-h-[min(40rem,calc(100dvh-1rem))] w-[min(60rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
        <h2 id="brand-picker-title" className="min-w-0 flex-1 text-lg font-semibold">{t.create.selectBrand}</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t.picker.close}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
          <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <li>
            {shown ? (
              <div aria-disabled className="block opacity-70">
                <Tiles><span className="flex size-10 items-center justify-center rounded-full bg-raised text-muted shadow-sm"><Plus /></span></Tiles>
                <p className="mt-2 text-sm font-semibold">{t.create.addBrand}</p>
                <p className="text-xs leading-snug text-muted">{t.create.moreBrandsSoon}</p>
              </div>
            ) : (
              <Link href="/dashboard/brand" prefetch={false} className="group block">
                <Tiles><span className="flex size-10 items-center justify-center rounded-full bg-raised text-fg shadow-sm transition group-hover:text-accent"><Plus /></span></Tiles>
                <p className="mt-2 text-sm font-semibold group-hover:text-accent">{t.create.addBrand}</p>
                <p className="text-xs leading-snug text-muted">{t.create.addBrandHint}</p>
              </Link>
            )}
          </li>
          {shown && (
            <li>
              <button type="button" onClick={() => setSelected((s) => !s)} aria-pressed={selected} data-brand-tile
                className="group block w-full text-start">
                <span className={"relative grid aspect-[3/2] grid-cols-[2fr_1fr] grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border transition " + (selected ? "border-accent ring-2 ring-accent" : "border-line group-hover:border-accent")}>
                  <span className="row-span-2 flex items-center justify-center bg-white p-4">
                    {shown.logoUrl
                      // eslint-disable-next-line @next/next/no-img-element -- signed brand logo
                      ? <img src={shown.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                      : <span className="text-3xl font-semibold text-neutral-800">{shown.name.slice(0, 1).toUpperCase()}</span>}
                  </span>
                  <span style={{ background: shown.accent }} />
                  <span className="flex items-center justify-center bg-surface text-sm font-semibold text-muted">Aa</span>
                  <span aria-hidden className={"absolute end-2 top-2 flex size-6 items-center justify-center rounded-full border-2 " + (selected ? "border-accent bg-accent text-white" : "border-white/90 bg-black/10")}>
                    {selected && <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5l3 3 7-7" /></svg>}
                  </span>
                </span>
                <span className="mt-2 block truncate text-sm font-semibold">{shown.name}</span>
                <span className="block text-xs text-muted">{shown.products === 1 ? t.create.oneProduct : fmt(t.create.productCount, { count: shown.products })}</span>
              </button>
              <Link href="/dashboard/brand" prefetch={false} className="mt-1 inline-flex min-h-9 items-center text-xs font-medium text-accent hover:underline">{t.create.editBrand}</Link>
            </li>
          )}
        </ul>
        <p className="mt-6 max-w-xl text-sm text-muted">{t.create.brandDnaHelp}</p>
      </div>
      <div className="flex justify-end border-t border-line px-4 py-3 sm:px-6">
        <button type="button" disabled={!selected} onClick={onContinue} className="btn-primary min-h-11 rounded-xl px-6 font-semibold">
          {t.create.continue}
        </button>
      </div>
    </dialog>
  );
}

// The quiet four-square backdrop of the "Add new brand" tile.
function Tiles({ children }: { children: ReactNode }) {
  return (
    <span className="relative grid aspect-[3/2] grid-cols-[2fr_1fr] grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border border-line">
      <span className="row-span-2 bg-surface" /><span className="bg-surface" /><span className="bg-surface" />
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted">{children}</span>;
}

function Spec({ children, title }: { children: ReactNode; title: string }) {
  return <span title={title} className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-muted" dir="ltr">{children}</span>;
}

function Check() {
  return <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5l3 3 7-7" /></svg>;
}

function Plus() {
  return <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>;
}

function ChipIcon() {
  return <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><rect x="5" y="5" width="10" height="10" rx="2" /><rect x="8" y="8" width="4" height="4" rx=".5" /><path d="M8 2.5V5M12 2.5V5M8 15v2.5M12 15v2.5M2.5 8H5M2.5 12H5M15 8h2.5M15 12h2.5" strokeLinecap="round" /></svg>;
}

function ImagesIcon() {
  return <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><rect x="5.5" y="2.5" width="12" height="10" rx="1.5" /><path d="M14.5 15.5v.5a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 16V8.5A1.5 1.5 0 014 7h1.5" /><path d="M5.5 10.5l3-3 3 2.5 2-1.5 4 3" /></svg>;
}

function ResolutionIcon() {
  return <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 6V2h4M14 10v4h-4M10 2h4v4M6 14H2v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BoltIcon() {
  return <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="currentColor"><path d="M9.2 1 3.5 9h3.6L6.4 15l6.1-8.4H8.8L9.2 1z" /></svg>;
}

// A frame drawn in the ratio itself.
function RatioIcon({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const scale = 14 / Math.max(w, h);
  const width = w * scale, height = h * scale;
  return <svg aria-hidden viewBox="0 0 18 18" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x={(18 - width) / 2} y={(18 - height) / 2} width={width} height={height} rx="2" /></svg>;
}

// The model maker as a small monogram tile.
function MakerMark({ maker }: { maker: ModelInfo["maker"] }) {
  const marks: Record<ModelInfo["maker"], { letter: string; color: string }> = {
    google: { letter: "G", color: "#4285F4" },
    flux: { letter: "F", color: "currentColor" },
    bytedance: { letter: "S", color: "#3C8CFF" },
    kling: { letter: "K", color: "#16A34A" },
  };
  const m = marks[maker];
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-base font-bold text-fg dark:bg-surface" style={{ color: m.color }}>
      {m.letter}
    </span>
  );
}

// Small network marks for where a size fits.
const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: "Instagram", facebook: "Facebook", x: "X", linkedin: "LinkedIn", google: "Google",
  pinterest: "Pinterest", tiktok: "TikTok", snapchat: "Snapchat", youtube: "YouTube Shorts",
};
function PlatformMark({ platform }: { platform: Platform }) {
  const glyph: Record<Platform, ReactNode> = {
    instagram: <><rect x="5" y="5" width="10" height="10" rx="3" stroke="#E1306C" strokeWidth="1.6" fill="none" /><circle cx="10" cy="10" r="2.4" stroke="#E1306C" strokeWidth="1.6" fill="none" /><circle cx="13" cy="7" r=".8" fill="#E1306C" /></>,
    facebook: <><circle cx="10" cy="10" r="6" fill="#1877F2" /><path d="M10.9 16v-4.3h1.4l.2-1.7h-1.6V9c0-.5.1-.8.8-.8h.9V6.7a11 11 0 00-1.3-.1c-1.3 0-2.1.8-2.1 2.2v1.2H7.8v1.7h1.4V16" fill="#fff" /></>,
    x: <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
    linkedin: <><rect x="4.5" y="4.5" width="11" height="11" rx="2" fill="#0A66C2" /><path d="M7.3 9v4M7.3 7.1v.1M9.6 13v-4M9.6 10.6c0-1 .7-1.6 1.5-1.6s1.4.5 1.4 1.6V13" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" /></>,
    google: <><path d="M15.5 10.2c0-.4 0-.8-.1-1.2H10v2.2h3.1a2.7 2.7 0 01-1.2 1.8v1.4h1.9c1.1-1 1.7-2.5 1.7-4.2z" fill="#4285F4" /><path d="M10 15.8c1.6 0 2.9-.5 3.8-1.4l-1.9-1.4c-.5.3-1.1.5-1.9.5-1.5 0-2.7-1-3.2-2.3h-2v1.5a5.8 5.8 0 005.2 3.1z" fill="#34A853" /><path d="M6.8 11.2a3.5 3.5 0 010-2.3V7.4h-2a5.8 5.8 0 000 5.3l2-1.5z" fill="#FBBC05" /><path d="M10 6.4c.9 0 1.6.3 2.2.9l1.7-1.7A5.8 5.8 0 004.8 7.4l2 1.5C7.3 7.5 8.5 6.4 10 6.4z" fill="#EA4335" /></>,
    pinterest: <><circle cx="10" cy="10" r="6" fill="#E60023" /><path d="M9.6 12.2l-.8 3.3M8.4 10.6c-.4-1.9.9-3.5 2.4-3.5 1.4 0 2.3 1 2.3 2.3 0 1.6-.8 2.9-2 2.9-.7 0-1.1-.5-1-1.1l.5-1.9" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" /></>,
    tiktok: <path d="M11.2 4.8v7.1a2.2 2.2 0 11-2.2-2.2M11.2 4.8c.3 1.5 1.4 2.5 2.9 2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />,
    snapchat: <><circle cx="10" cy="10" r="6" fill="#FFFC00" /><path d="M10 6.6c1.3 0 2.1 1 2.1 2.2v1l.8-.2-.6.9c.2.6.9.9 1.2 1-.4.4-1 .4-1.4.6l-.3.7c-.6-.1-1.1.1-1.8.6-.7-.5-1.2-.7-1.8-.6l-.3-.7c-.4-.2-1-.2-1.4-.6.3-.1 1-.4 1.2-1l-.6-.9.8.2v-1c0-1.2.8-2.2 2.1-2.2z" fill="#fff" stroke="#111" strokeWidth=".6" /></>,
    youtube: <><rect x="4" y="6" width="12" height="8.5" rx="2.4" fill="#FF0000" /><path d="M9 8.4v3.8l3.2-1.9z" fill="#fff" /></>,
  };
  return (
    <span role="img" aria-label={PLATFORM_NAMES[platform]} title={PLATFORM_NAMES[platform]}
      className="flex size-7 items-center justify-center rounded-full border border-line bg-raised text-fg">
      <svg viewBox="0 0 20 20" className="size-5">{glyph[platform]}</svg>
    </span>
  );
}

