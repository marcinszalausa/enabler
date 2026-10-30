"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { publishAds, type PublishState } from "../../publishing/actions";
import { platformName, takesKind } from "@/lib/social/platforms";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { smallButton } from "../../ui";
import { useBrowserTimeZone } from "../../time-zone";

export type PublishCreative = {
  id: string;
  kind: "image" | "video";
  aspect: string;
  caption: string;
};

export type PublishAccount = {
  id: string;
  platform: string;
  name: string;
};

const initialState: PublishState = { error: null, done: null };
const OPEN_EVENT = "gooidy:publish";

const field =
  "w-full rounded-md border border-line-strong bg-raised px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20";

// A small "Publish" on one ad: opens its run's dialog with only that ad.
export function PublishOneButton({
  generationId,
  creativeId,
}: {
  generationId: string;
  creativeId: string;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={smallButton}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(OPEN_EVENT, {
            detail: { generationId, creativeId },
          }),
        )
      }
    >
      <SendIcon />
      {t.publish.publish}
    </button>
  );
}

// Publish a run's ads (all or some) to the connected accounts (all or some),
// now, into the weekly queue, or at a chosen time.
export function PublishDialog({
  generationId,
  creatives,
  accounts,
  nextSlot,
}: {
  generationId: string;
  creatives: PublishCreative[];
  accounts: PublishAccount[];
  // The next free queue time, already worded; null with no schedule.
  nextSlot: string | null;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const runDefault = creatives
    .filter((c) => c.kind === "video" || c.aspect === "1:1")
    .map((c) => c.id);
  // Each opening starts a fresh form (and clears the last result).
  const [opened, setOpened] = useState<{ at: number; ads: string[] }>({
    at: 0,
    ads: runDefault,
  });

  useEffect(() => {
    function open(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.generationId !== generationId) return;
      setOpened({ at: Date.now(), ads: [detail.creativeId] });
      dialog.current?.showModal();
    }
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [generationId]);

  return (
    <>
      <button
        type="button"
        className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
        onClick={() => {
          setOpened({ at: Date.now(), ads: runDefault });
          dialog.current?.showModal();
        }}
      >
        <SendIcon />
        {t.publish.publishRun}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-line bg-raised p-0 text-fg shadow-2xl backdrop:bg-black/50"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        {accounts.length === 0 ? (
          <div className="flex flex-col items-start gap-4 p-6">
            <p className="text-lg font-semibold">{t.publish.publishRun}</p>
            <p className="text-sm text-muted">{t.publish.noAccountsYet}</p>
            <Link
              href="/dashboard/publishing"
              className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
            >
              {t.publish.goConnect}
            </Link>
          </div>
        ) : (
          <PublishForm
            key={opened.at}
            initialAds={opened.ads}
            creatives={creatives}
            accounts={accounts}
            nextSlot={nextSlot}
            close={() => dialog.current?.close()}
          />
        )}
      </dialog>
    </>
  );
}

function PublishForm({
  initialAds,
  creatives,
  accounts,
  nextSlot,
  close,
}: {
  initialAds: string[];
  creatives: PublishCreative[];
  accounts: PublishAccount[];
  nextSlot: string | null;
  close: () => void;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(publishAds, initialState);
  const [ads, setAds] = useState<string[]>(initialAds);
  const [picked, setPicked] = useState<string[]>(accounts.map((a) => a.id));
  const [when, setWhen] = useState<"now" | "queue" | "at">(
    nextSlot ? "queue" : "now",
  );
  const timeZone = useBrowserTimeZone();

  const chosen = creatives.filter((c) => ads.includes(c.id));
  const kinds = new Set(chosen.map((c) => c.kind));
  const usable = (a: PublishAccount) =>
    [...kinds].some((k) => takesKind(a.platform, k));
  const targets = accounts.filter((a) => picked.includes(a.id) && usable(a));
  const single = chosen.length === 1 ? chosen[0] : null;
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <form
      action={action}
      className="flex max-h-[85vh] flex-col gap-5 overflow-y-auto p-6 text-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-lg font-semibold">{t.publish.publishRun}</p>
        <button
          type="button"
          onClick={close}
          className="rounded-md px-2 text-xl leading-none text-muted hover:text-fg"
          aria-label={t.app.cancel}
        >
          ×
        </button>
      </div>

      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between font-medium">
          {t.publish.ads}
          <button
            type="button"
            className="text-xs font-normal text-accent"
            onClick={() =>
              setAds(
                ads.length === creatives.length
                  ? []
                  : creatives.map((c) => c.id),
              )
            }
          >
            {t.publish.selectAll}
          </button>
        </legend>
        <div className="grid grid-cols-4 items-start gap-2 sm:grid-cols-5">
          {creatives.map((c) => (
            <label
              key={c.id}
              className="relative cursor-pointer overflow-hidden rounded-lg border-2 border-transparent has-checked:border-accent"
            >
              <input
                type="checkbox"
                name="creativeIds"
                value={c.id}
                checked={ads.includes(c.id)}
                onChange={() => setAds(toggle(ads, c.id))}
                className="absolute left-1 top-1 z-10 accent-accent"
              />
              {c.kind === "video" ? (
                <video
                  src={`/api/creatives/${c.id}/video`}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-[9/16] w-full bg-surface object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- rendered on demand by our own route
                <img
                  src={`/api/creatives/${c.id}/image`}
                  alt=""
                  loading="lazy"
                  className={`w-full bg-surface object-cover ${
                    c.aspect === "1:1" ? "aspect-square" : "aspect-[9/16]"
                  }`}
                />
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between font-medium">
          {t.publish.to}
          <button
            type="button"
            className="text-xs font-normal text-accent"
            onClick={() =>
              setPicked(
                picked.length === accounts.length
                  ? []
                  : accounts.map((a) => a.id),
              )
            }
          >
            {t.publish.selectAll}
          </button>
        </legend>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <label
              key={a.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent ${
                usable(a) ? "" : "opacity-40"
              }`}
              title={
                usable(a)
                  ? undefined
                  : takesKind(a.platform, "image")
                    ? t.publish.imagesOnly
                    : t.publish.videosOnly
              }
            >
              <input
                type="checkbox"
                name="accountIds"
                value={a.id}
                checked={picked.includes(a.id) && usable(a)}
                disabled={!usable(a)}
                onChange={() => setPicked(toggle(picked, a.id))}
                className="sr-only"
              />
              <span className="font-medium">{platformName(a.platform)}</span>
              <span className="max-w-32 truncate opacity-75">{a.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t.publish.when}</legend>
        <WhenOption
          value="now"
          current={when}
          onPick={setWhen}
          label={t.publish.now}
        />
        <WhenOption
          value="queue"
          current={when}
          onPick={setWhen}
          label={t.publish.queue}
          note={
            nextSlot ? fmt(t.publish.nextSlot, { time: nextSlot }) : undefined
          }
          disabled={!nextSlot}
        >
          {!nextSlot && (
            <Link
              href="/dashboard/publishing#schedule"
              className="text-accent underline underline-offset-4"
            >
              {t.publish.setSchedule}
            </Link>
          )}
        </WhenOption>
        <WhenOption
          value="at"
          current={when}
          onPick={setWhen}
          label={t.publish.pickTime}
        >
          {when === "at" && (
            <input
              type="datetime-local"
              name="at"
              required
              className={`${field} mt-1 w-auto`}
            />
          )}
        </WhenOption>
        <input type="hidden" name="timeZone" value={timeZone} />
      </fieldset>

      {single && (
        <label key={single.id} className="flex flex-col gap-1.5">
          <span className="font-medium">{t.publish.caption}</span>
          <textarea
            name="caption"
            rows={4}
            maxLength={2200}
            defaultValue={single.caption}
            className={field}
          />
        </label>
      )}

      {targets.some((a) => a.platform === "tiktok") && (
        <p className="text-xs text-muted">
          {/* TikTok requires this line before anything is posted there. */}
          <a
            href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {t.publish.tiktokConsent}
          </a>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || chosen.length === 0 || targets.length === 0}
          className="btn-primary rounded-lg px-4 py-2 font-medium"
        >
          {pending
            ? t.publish.publishing
            : fmt(t.publish.publishCount, { count: chosen.length })}
        </button>
        {state.done && (
          <p role="status" className="text-ok">
            {state.done}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

function WhenOption({
  value,
  current,
  onPick,
  label,
  note,
  disabled,
  children,
}: {
  value: "now" | "queue" | "at";
  current: string;
  onPick: (v: "now" | "queue" | "at") => void;
  label: string;
  note?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label
        className={`flex flex-wrap items-center gap-x-2 ${disabled ? "text-muted" : "cursor-pointer"}`}
      >
        <input
          type="radio"
          name="when"
          value={value}
          checked={current === value}
          disabled={disabled}
          onChange={() => onPick(value)}
          className="accent-accent"
        />
        <span>{label}</span>
        {note && <span className="text-muted">· {note}</span>}
      </label>
      {children && <div className="pl-6">{children}</div>}
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
