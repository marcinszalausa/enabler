"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import {
  AVATAR_AGES, AVATAR_CREDITS, AVATAR_DESCRIPTION_MAX, AVATAR_GENDERS, AVATAR_LOOKS, AVATAR_NAME_MAX,
  type AvatarAge, type AvatarGender, type AvatarLook,
} from "@/lib/avatar-library";
import { createAvatar, listAvatars, type AvatarItem } from "./avatar-actions";
import { UploadIcon, shrink } from "./image-picker";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SEND_BYTES = 2.8 * 1024 * 1024;
const AGE_LABEL: Record<AvatarAge, string> = { young: "20–29", adult: "30–44", mature: "45–59", senior: "60+" };

export type PickedAvatar = { id: string; src: string; name: string };

// The create card's "Avatar" row: none by default (Gooidy decides who
// appears), or an AI person the image ads feature.
export function AvatarRow({ avatar, onPick, credits }: { avatar: PickedAvatar | null; onPick: (a: PickedAvatar | null) => void; credits?: number }) {
  const { t } = useI18n();
  const a = t.avatars;
  const [open, setOpen] = useState(false);
  return (
    <div data-avatar-row className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2.5 sm:px-4">
      <button type="button" onClick={() => setOpen(true)} aria-label={avatar ? a.change : a.choose}
        className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised text-muted focus-visible:ring-2 focus-visible:ring-accent">
        {avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatar.src} alt="" className="size-full object-cover object-top" />
          : <PersonIcon />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{a.title}</p>
        <p className="truncate text-sm text-muted">{avatar ? avatar.name : a.auto}</p>
      </div>
      {avatar && (
        <button type="button" onClick={() => onPick(null)} aria-label={a.remove} title={a.remove} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg">
          <CloseIcon className="size-4" />
        </button>
      )}
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-accent hover:underline">
        {avatar ? a.change : a.choose}
      </button>
      {open && <AvatarPicker selected={avatar?.id ?? null} credits={credits} onClose={() => setOpen(false)}
        onPick={(p) => { onPick(p); setOpen(false); }} />}
    </div>
  );
}

type GenderFilter = "all" | "yours" | AvatarGender;

function AvatarPicker({ selected, credits, onPick, onClose }: {
  selected: string | null; credits?: number; onPick: (a: PickedAvatar) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  const a = t.avatars;
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<AvatarItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [gender, setGender] = useState<GenderFilter>("all");
  const [age, setAge] = useState<AvatarAge | "">("");
  const [look, setLook] = useState<AvatarLook | "">("");
  const [view, setView] = useState<"library" | "create">("library");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    let live = true;
    listAvatars().then((d) => live && setItems(d), () => live && setLoadFailed(true));
    return () => { live = false; };
  }, []);

  const list = items ?? [];
  const genders: GenderFilter[] = ["all", ...(list.some((i) => i.yours) ? ["yours" as const] : []),
    ...AVATAR_GENDERS.filter((g) => list.some((i) => i.gender === g))];
  const shown = list.filter((i) => (gender === "all" || (gender === "yours" ? i.yours : i.gender === gender))
    && (!age || i.age === age) && (!look || i.look === look));
  const genderLabel = (g: GenderFilter) => g === "all" ? a.all : g === "yours" ? a.yours : a.genders[g];
  const chip = (active: boolean) => "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm transition " + (active ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:border-line-strong hover:text-fg");
  const select = "min-h-10 shrink-0 rounded-full border border-line bg-bg px-3 text-sm text-fg hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent";
  const close = () => { if (!busy) dialog.current?.close(); };

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="avatar-picker-title"
      onCancel={(e) => { if (busy) e.preventDefault(); }}
      onClick={(e) => { if (e.target === dialog.current) close(); }}
      className="m-auto max-h-[min(48rem,calc(100dvh-1rem))] w-[min(64rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-bg p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
        {view === "create" && (
          <button type="button" onClick={() => !busy && setView("library")} aria-label={a.back} disabled={busy}
            className="-ms-2 inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
            <svg aria-hidden viewBox="0 0 20 20" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5L7 10l5.5 5.5" /></svg>
          </button>
        )}
        <h2 id="avatar-picker-title" className="min-w-0 flex-1 text-lg font-semibold">{view === "create" ? a.createTitle : a.dialogTitle}</h2>
        <button type="button" onClick={close} aria-label={t.picker.close} disabled={busy}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-fg">
          <CloseIcon className="size-5" />
        </button>
      </div>
      {view === "create"
        ? <CreateAvatar credits={credits} busy={busy} setBusy={setBusy}
            onCreated={(item) => { setItems((d) => [item, ...(d ?? [])]); onPick({ id: item.id, src: item.src, name: item.name }); }} />
        : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
          {list.length > 0 && (
            <div role="group" aria-label={a.filter} className="-mx-4 flex shrink-0 items-center gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" data-avatar-filter>
              {genders.length > 2 && genders.map((g) => (
                <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(g)} className={chip(gender === g)}>{genderLabel(g)}</button>
              ))}
              <select aria-label={a.ageLabel} value={age} onChange={(e) => setAge(e.target.value as AvatarAge | "")} className={select}>
                <option value="">{a.anyAge}</option>
                {AVATAR_AGES.map((v) => <option key={v} value={v}>{AGE_LABEL[v]}</option>)}
              </select>
              <select aria-label={a.lookLabel} value={look} onChange={(e) => setLook(e.target.value as AvatarLook | "")} className={select}>
                <option value="">{a.anyLook}</option>
                {AVATAR_LOOKS.map((v) => <option key={v} value={v}>{a.looks[v]}</option>)}
              </select>
            </div>
          )}
          <p className="text-sm text-muted">{a.hint}</p>
          <ul className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-avatar-grid>
            <li>
              <button type="button" onClick={() => setView("create")} data-create-tile
                className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong p-3 text-center transition hover:border-accent hover:bg-accent-soft/50">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
                </span>
                <span className="text-sm font-medium">{a.create}</span>
                <span className="text-xs text-muted">{fmt(t.app.credits, { count: AVATAR_CREDITS })}</span>
              </button>
            </li>
            {!items && !loadFailed && Array.from({ length: 9 }, (_, i) => (
              <li key={i} aria-hidden className="aspect-[3/4] animate-pulse rounded-xl bg-surface" />
            ))}
            {shown.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onPick({ id: item.id, src: item.src, name: item.name })} aria-pressed={selected === item.id}
                  aria-label={`${item.name}, ${a.gender[item.gender]}, ${AGE_LABEL[item.age]}, ${a.looks[item.look]}`}
                  className={"group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border bg-surface transition focus-visible:ring-2 focus-visible:ring-accent " + (selected === item.id ? "border-accent ring-2 ring-accent" : "border-line hover:border-accent")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.02]" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-start text-white">
                    <span className="block truncate text-sm font-semibold">{item.name}</span>
                    <span className="block truncate text-[11px] opacity-85">{AGE_LABEL[item.age]} · {a.looks[item.look]}</span>
                  </span>
                  {selected === item.id && (
                    <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-accent text-white shadow" aria-hidden>
                      <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10.5l3 3 7-7" /></svg>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {items && items.length === 0 && <p className="text-sm text-muted">{a.empty}</p>}
          {items && items.length > 0 && shown.length === 0 && <p className="text-sm text-muted">{a.noMatch}</p>}
          {loadFailed && <p role="alert" className="text-sm text-danger">{t.picker.loadFailed}</p>}
        </div>
      )}
    </dialog>
  );
}

function CreateAvatar({ credits, busy, setBusy, onCreated }: {
  credits?: number; busy: boolean; setBusy: (b: boolean) => void; onCreated: (item: AvatarItem) => void;
}) {
  const { t } = useI18n();
  const a = t.avatars;
  const fileInput = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState<AvatarGender>("woman");
  const [age, setAge] = useState<AvatarAge>("adult");
  const [look, setLook] = useState<AvatarLook>("casual");
  const [photo, setPhoto] = useState<{ blob: Blob; src: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const short = credits !== undefined && credits < AVATAR_CREDITS;

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.src); }, [photo]);

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/") && !/\.(heic|heif|avif)$/i.test(file.name)) return setError(t.picker.badType);
    if (file.size > MAX_FILE_BYTES) return setError(t.picker.tooBig);
    try {
      const blob = await shrink(file);
      if (blob.size > MAX_SEND_BYTES) return setError(t.picker.tooBig);
      setPhoto({ blob, src: URL.createObjectURL(blob) });
    } catch {
      setError(t.picker.badType);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    if (!String(form.get("name") ?? "").trim()) return setError(a.nameRequired);
    if (photo && form.get("consent") !== "on") return setError(a.consentRequired);
    form.set("gender", gender);
    form.set("age", age);
    form.set("look", look);
    if (photo) form.set("photo", photo.blob, "photo.jpg");
    setError(null);
    setBusy(true);
    try {
      const result = await createAvatar(form);
      if ("error" in result) return setError(result.error);
      onCreated(result.avatar);
    } catch {
      setError(a.createFailed);
    } finally {
      setBusy(false);
    }
  }

  const label = "mb-1.5 block text-sm font-medium";
  const group = "flex w-full overflow-hidden rounded-xl border border-line-strong";
  const segment = "flex min-h-11 flex-1 cursor-pointer items-center justify-center border-line-strong px-2 text-center text-sm not-last:border-e has-checked:bg-accent-soft has-checked:font-medium has-checked:text-accent has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-accent";
  const field = "w-full rounded-xl border border-line-strong bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none";
  const radios = <T extends string>(name: string, values: readonly T[], value: T, set: (v: T) => void, text: (v: T) => string) => (
    <div role="radiogroup" className={group}>
      {values.map((v) => (
        <label key={v} className={segment}>
          <input type="radio" name={`avatar-${name}`} value={v} checked={value === v} onChange={() => set(v)} className="sr-only" disabled={busy} />
          {text(v)}
        </label>
      ))}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" data-avatar-create>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
        <p className="text-sm text-muted">{a.createHint}</p>
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-8">
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="avatar-name" className={label}>{a.name}</label>
              <input id="avatar-name" name="name" maxLength={AVATAR_NAME_MAX} placeholder={a.namePlaceholder} autoComplete="off" className={field} />
            </div>
            <div>
              <p className={label}>{a.genderLabel}</p>
              {radios("gender", AVATAR_GENDERS, gender, setGender, (v) => a.gender[v])}
            </div>
            <div>
              <p className={label}>{a.ageLabel}</p>
              {radios("age", AVATAR_AGES, age, setAge, (v) => AGE_LABEL[v])}
            </div>
            <div>
              <p className={label}>{a.lookLabel}</p>
              <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AVATAR_LOOKS.map((v) => (
                  <label key={v} className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line-strong px-2 text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:font-medium has-checked:text-accent has-focus-visible:ring-2 has-focus-visible:ring-accent">
                    <input type="radio" name="avatar-look" value={v} checked={look === v} onChange={() => setLook(v)} className="sr-only" />
                    {a.looks[v]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="avatar-details" className={label}>{a.details}</label>
              <textarea id="avatar-details" name="details" rows={3} maxLength={AVATAR_DESCRIPTION_MAX} placeholder={a.detailsPlaceholder} className={field + " resize-none"} />
            </div>
            <div>
              <p className={label}>{a.photo}</p>
              <div className="flex items-center gap-3">
                {photo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.src} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                    <button type="button" onClick={() => setPhoto(null)} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-accent hover:underline">{a.removePhoto}</button>
                  </>
                ) : (
                  <button type="button" onClick={() => fileInput.current?.click()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 text-sm font-medium hover:border-accent hover:bg-accent-soft/50">
                    <span className="text-accent"><UploadIcon /></span>{t.picker.upload}
                  </button>
                )}
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif" className="sr-only" tabIndex={-1}
                  onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              <p className="mt-1.5 text-xs leading-snug text-muted">{a.photoHint}</p>
              {photo && (
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm">
                  <input type="checkbox" name="consent" className="mt-0.5 size-4 shrink-0 accent-accent" />
                  <span>{a.consent}</span>
                </label>
              )}
            </div>
          </div>
        </div>
      </fieldset>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <div className="min-w-0 flex-1" aria-live="polite">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {!error && short && <p className="text-sm text-muted">{a.notEnough}</p>}
          {busy && <p className="text-sm text-muted">{a.creating}</p>}
        </div>
        <button type="submit" disabled={busy || short}
          className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold">
          {busy && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />}
          {fmt(a.submit, { credits: AVATAR_CREDITS })}
        </button>
      </div>
    </form>
  );
}

function PersonIcon() {
  return <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="10" cy="7" r="3.2" /><path d="M3.8 17c.8-3.2 3.3-5 6.2-5s5.4 1.8 6.2 5" /></svg>;
}

function CloseIcon({ className }: { className: string }) {
  return <svg aria-hidden viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>;
}
