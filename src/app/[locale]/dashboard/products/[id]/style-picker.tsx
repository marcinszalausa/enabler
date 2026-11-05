"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useI18n } from "@/i18n/client";
import { STYLE_CATEGORIES } from "@/lib/style-library";
import { listStyles, uploadStyle, type StyleItem } from "./style-actions";
import { UploadIcon, shrink } from "./image-picker";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SEND_BYTES = 2.8 * 1024 * 1024;

export type PickedStyle = { id: string; src: string };

// The create card's "Style" row: none by default (Gooidy picks the scene),
// or a reference image whose look the ads follow.
export function StyleRow({ style, onPick }: { style: PickedStyle | null; onPick: (s: PickedStyle | null) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div data-style-row className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2.5 sm:px-4">
      <button type="button" onClick={() => setOpen(true)} aria-label={style ? t.styles.change : t.styles.choose}
        className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-raised text-muted focus-visible:ring-2 focus-visible:ring-accent">
        {style
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={style.src} alt="" className="size-full object-cover" />
          : <SparkIcon />}
      </button>
      <div className="min-w-0 flex-1 contain-inline-size">
        <p className="text-sm font-medium">{t.styles.title}</p>
        <p className="truncate text-sm text-muted">{style ? t.styles.picked : t.styles.auto}</p>
      </div>
      {style && (
        <button type="button" onClick={() => onPick(null)} aria-label={t.styles.remove} title={t.styles.remove} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg">
          <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      )}
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-accent hover:underline">
        {style ? t.styles.change : t.styles.choose}
      </button>
      {open && <StylePicker selected={style?.id ?? null} onClose={() => setOpen(false)}
        onPick={(s) => { onPick(s); setOpen(false); }} />}
    </div>
  );
}

type Filter = "all" | "yours" | (typeof STYLE_CATEGORIES)[number];

function StylePicker({ selected, onPick, onClose }: {
  selected: string | null; onPick: (s: PickedStyle) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<StyleItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    let live = true;
    listStyles().then((d) => live && setItems(d), () => live && setLoadFailed(true));
    return () => { live = false; };
  }, []);

  const hasYours = (items ?? []).some((i) => i.category === "yours");
  const filters: Filter[] = ["all", ...(hasYours ? ["yours" as const] : []), ...STYLE_CATEGORIES.filter((c) => (items ?? []).some((i) => i.category === c))];
  const shown = (items ?? []).filter((i) => filter === "all" || i.category === filter);

  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    setError(null);
    if (!file.type.startsWith("image/") && !/\.(heic|heif|avif)$/i.test(file.name)) return setError(t.picker.badType);
    if (file.size > MAX_FILE_BYTES) return setError(t.picker.tooBig);
    setUploading(true);
    try {
      const body = await shrink(file);
      if (body.size > MAX_SEND_BYTES) throw new Error("too big");
      const form = new FormData();
      form.set("file", body);
      const result = await uploadStyle(form);
      if ("error" in result) return setError(result.error);
      setItems((d) => [result.style, ...(d ?? [])]);
      onPick({ id: result.style.id, src: result.style.src });
    } catch {
      setError(t.picker.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files?.[0]);
  }

  const label = (f: Filter) => f === "all" ? t.styles.all : f === "yours" ? t.styles.yours : t.styles.categories[f];
  const chip = (active: boolean) => "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm transition " + (active ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:border-line-strong hover:text-fg");

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="style-picker-title"
      onClick={(e) => { if (e.target === dialog.current && !uploading) dialog.current.close(); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.target === dialog.current) setDragging(false); }}
      onDrop={onDrop}
      className="m-auto max-h-[min(48rem,calc(100dvh-1rem))] w-[min(64rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
        <h2 id="style-picker-title" className="min-w-0 flex-1 text-lg font-semibold">{t.styles.dialogTitle}</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t.picker.close}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
          <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
        {filters.length > 1 && (
          <div role="group" aria-label={t.styles.filter} className="-mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" data-style-filter>
            {filters.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chip(filter === f)}>{label(f)}</button>
            ))}
          </div>
        )}
        <p className="text-sm text-muted">{t.styles.hint}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <ul className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-style-grid>
          <li>
            <button type="button" onClick={() => input.current?.click()} disabled={uploading} data-upload-tile
              className={"flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center transition " + (dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent hover:bg-accent-soft/50")}>
              {uploading
                ? <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
                : <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent"><UploadIcon /></span>}
              <span className="text-sm font-medium">{uploading ? t.picker.uploading : t.styles.upload}</span>
              <span className="hidden text-xs leading-snug text-muted sm:block">{t.picker.drop}</span>
            </button>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif" className="sr-only" tabIndex={-1}
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          </li>
          {!items && !loadFailed && Array.from({ length: 9 }, (_, i) => (
            <li key={i} aria-hidden className="aspect-[3/4] animate-pulse rounded-xl bg-surface" />
          ))}
          {shown.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick({ id: item.id, src: item.src })} aria-pressed={selected === item.id}
                aria-label={label(item.category)}
                className={"group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border bg-surface transition focus-visible:ring-2 focus-visible:ring-accent " + (selected === item.id ? "border-accent ring-2 ring-accent" : "border-line hover:border-accent")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.02]" />
                <span className="absolute start-2 bottom-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{label(item.category)}</span>
                {selected === item.id && (
                  <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-accent text-white shadow" aria-hidden>
                    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5l3 3 7-7" /></svg>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {items && items.length === 0 && <p className="text-sm text-muted">{t.styles.empty}</p>}
        {loadFailed && <p role="alert" className="text-sm text-danger">{t.picker.loadFailed}</p>}
      </div>
    </dialog>
  );
}

function SparkIcon() {
  return <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M10 2.5l1.7 4.3 4.3 1.7-4.3 1.7L10 14.5l-1.7-4.3L4 8.5l4.3-1.7L10 2.5zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" /></svg>;
}
