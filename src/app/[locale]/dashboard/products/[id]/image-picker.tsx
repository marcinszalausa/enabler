"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useI18n } from "@/i18n/client";
import { listPickerImages, uploadProductImage, type PickerData, type PickerImage } from "./image-actions";

export type PickedPhoto = { value: string; src: string; uploaded: boolean };

const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Server actions accept 3 MB; scaled photos are far below that.
const MAX_SEND_BYTES = 2.8 * 1024 * 1024;
const MAX_SIDE = 2048;

// The create card's "Product photo" row: shows the photo the next run starts
// from and opens the picker to choose another or upload a new one.
export function PhotoRow({
  productId,
  photo,
  onPick,
}: {
  productId: string;
  photo: PickedPhoto | null;
  onPick: (photo: PickedPhoto) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div data-photo-row className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2.5 sm:px-4">
      <button type="button" onClick={() => setOpen(true)} aria-label={t.picker.change}
        className="size-12 shrink-0 overflow-hidden rounded-lg border border-line bg-raised focus-visible:ring-2 focus-visible:ring-accent">
        {photo
          // eslint-disable-next-line @next/next/no-img-element -- store photos come from any host
          ? <img src={photo.src} alt="" className="size-full object-cover" />
          : <PhotoIcon className="m-auto size-5 text-muted" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t.picker.photo}</p>
        <p className="truncate text-sm text-muted">{photo ? (photo.uploaded ? t.picker.fromUpload : t.picker.fromStore) : t.picker.none}</p>
      </div>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-accent hover:underline">
        {t.picker.change}
      </button>
      {open && <PhotoPicker productId={productId} selected={photo?.value ?? null}
        onClose={() => setOpen(false)}
        onPick={(p) => { onPick(p); setOpen(false); }} />}
    </div>
  );
}

function PhotoPicker({
  productId,
  selected,
  onPick,
  onClose,
}: {
  productId: string;
  selected: string | null;
  onPick: (photo: PickedPhoto) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<PickerData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<string>(productId);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    let live = true;
    listPickerImages().then((d) => live && setData(d), () => live && setLoadFailed(true));
    return () => { live = false; };
  }, []);

  const images = (data?.images ?? []).filter((i) => filter === "all" || i.productId === filter);

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
      form.set("productId", productId);
      form.set("file", body);
      const result = await uploadProductImage(form);
      if ("error" in result) return setError(result.error);
      setData((d) => d && { ...d, images: [result.image, ...d.images] });
      setFilter((f) => (f === "all" ? f : productId));
      onPick(asPicked(result.image));
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

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="photo-picker-title"
      onClick={(e) => { if (e.target === dialog.current && !uploading) dialog.current.close(); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.target === dialog.current) setDragging(false); }}
      onDrop={onDrop}
      className="m-auto max-h-[min(44rem,calc(100dvh-1rem))] w-[min(56rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
        <h2 id="photo-picker-title" className="min-w-0 flex-1 text-lg font-semibold">{t.picker.title}</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t.picker.close}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
          <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
        {data && data.products.length > 1 && (
          <ProductFilter products={data.products} value={filter} onChange={setFilter} counts={countBy(data.images)} />
        )}
        <p className="text-sm text-muted">{t.picker.hint}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-photo-grid>
          <li>
            <button type="button" onClick={() => input.current?.click()} disabled={uploading} data-upload-tile
              className={"flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center transition " + (dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent hover:bg-accent-soft/50")}>
              {uploading
                ? <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
                : <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent"><UploadIcon /></span>}
              <span className="text-sm font-medium">{uploading ? t.picker.uploading : t.picker.upload}</span>
              <span className="hidden text-xs leading-snug text-muted sm:block">{t.picker.drop}</span>
              <span className="text-[11px] leading-snug text-muted">{t.picker.formats}</span>
            </button>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif" className="sr-only" tabIndex={-1}
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          </li>
          {!data && !loadFailed && Array.from({ length: 5 }, (_, i) => (
            <li key={i} aria-hidden className="aspect-square animate-pulse rounded-xl bg-surface" />
          ))}
          {images.map((image) => (
            <li key={image.value}>
              <button type="button" onClick={() => onPick(asPicked(image))} aria-pressed={selected === image.value}
                className={"group relative block aspect-square w-full overflow-hidden rounded-xl border bg-surface transition focus-visible:ring-2 focus-visible:ring-accent " + (selected === image.value ? "border-accent ring-2 ring-accent" : "border-line hover:border-accent")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- store photos come from any host */}
                <img src={image.src} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.02]" />
                {image.uploaded && <span className="absolute start-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{t.picker.uploaded}</span>}
                {selected === image.value && (
                  <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-accent text-white shadow" aria-hidden>
                    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5l3 3 7-7" /></svg>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {data && images.length === 0 && <p className="text-sm text-muted">{t.picker.empty}</p>}
        {loadFailed && <p role="alert" className="text-sm text-danger">{t.picker.loadFailed}</p>}
      </div>
    </dialog>
  );
}

// "This product", "All products" and each other product, with photo counts.
function ProductFilter({ products, value, onChange, counts }: {
  products: PickerData["products"]; value: string; onChange: (v: string) => void; counts: Map<string, number>;
}) {
  const { t } = useI18n();
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const chip = (active: boolean) => "inline-flex min-h-10 max-w-56 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition " + (active ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:border-line-strong hover:text-fg");
  return (
    <div role="group" aria-label={t.picker.filter} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" data-photo-filter>
      <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")} className={chip(value === "all")}>
        {t.picker.allProducts}<span className="text-xs opacity-70">{total}</span>
      </button>
      {products.map((p) => (
        <button key={p.id} type="button" aria-pressed={value === p.id} onClick={() => onChange(p.id)} className={chip(value === p.id)} title={p.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.photo ? <img src={p.photo} alt="" className="-ms-1.5 size-7 shrink-0 rounded-full object-cover" /> : null}
          <span className="truncate">{p.name}</span><span className="text-xs opacity-70">{counts.get(p.id) ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

function countBy(images: PickerImage[]) {
  const m = new Map<string, number>();
  for (const i of images) m.set(i.productId, (m.get(i.productId) ?? 0) + 1);
  return m;
}

function asPicked(i: PickerImage): PickedPhoto {
  return { value: i.value, src: i.src, uploaded: i.uploaded };
}

// Scales a photo to at most 2048 px as a JPEG in the browser, so phone photos
// of 5–10 MB upload fast. Formats the browser can't open are sent as they are.
async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  return blob ?? file;
}

function UploadIcon() {
  return <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13v2a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-2" /></svg>;
}

function PhotoIcon({ className }: { className?: string }) {
  return <svg aria-hidden viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><rect x="2.5" y="3.5" width="15" height="13" rx="2" /><circle cx="7" cy="8" r="1.5" /><path d="M17.5 13l-4-4-8 7.5" /></svg>;
}
