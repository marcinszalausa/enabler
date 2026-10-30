"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAngles, useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

export type DemoRun = {
  url: string;
  store: string;
  summary: string;
  audience: string;
  madeIn?: string;
  ads: { id: string; angle: string; headline: string; image: string }[];
};

// Stage timings in ms from the start of a play.
const T = { read: 1600, angles: 4200, design: 6400, done: 9200 };

// One real run played back as it happens in Gooidy: the link goes in, the
// brief Gooidy wrote from the page appears, then the angles and headlines,
// then the finished ads. Every word and image is from that run, unedited.
// It plays once when scrolled into view and can be replayed.
export function RunDemo({ run }: { run: DemoRun }) {
  const root = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(-1);
  const [play, setPlay] = useState(0);
  const [selected, setSelected] = useState(0);
  const { t: m } = useI18n();
  const angle = useAngles();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(99999);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setPlay((p) => p || 1);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!play) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = now - start;
      setT(elapsed);
      if (elapsed < T.done + 200) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [play]);

  // Types text out over `ms`, however long it is.
  const typed = (text: string, from: number, ms = 1800) =>
    text.slice(0, Math.max(0, Math.ceil(((t - from) / ms) * text.length)));
  const url = typed(run.url.replace(/^https?:\/\//, ""), 0, T.read - 500);
  const typingUrl = t >= 0 && t < T.read;

  const steps = [
    { label: m.demo.reading, at: T.read },
    { label: m.demo.writing, at: T.angles },
    { label: m.demo.designing, at: T.design },
  ];
  const ads = run.ads.slice(0, 5);

  return (
    <div
      ref={root}
      className="edge overflow-hidden shadow-[0_40px_100px_-40px_rgb(var(--t-shadow)/0.45)]"
    >
      {/* Window bar */}
      <div className="flex items-center gap-3 border-b border-line bg-surface/70 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto rounded-md bg-bg px-3 py-1 text-xs text-muted">
          gooidy.com/dashboard
        </span>
        <span className="w-12" />
      </div>

      <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
        {/* Progress */}
        <ol className="flex gap-4 overflow-x-auto border-b border-line p-5 text-sm lg:flex-col lg:border-b-0 lg:border-r">
          {steps.map((s, i) => {
            const next = steps[i + 1]?.at ?? T.done;
            const state = t >= next ? "done" : t >= s.at ? "now" : "todo";
            return (
              <li key={s.label} className="flex shrink-0 items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors ${
                    state === "done"
                      ? "bg-accent text-accent-fg"
                      : state === "now"
                        ? "bg-accent-soft text-accent ring-2 ring-accent/40"
                        : "bg-surface text-muted"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className={state === "todo" ? "text-muted" : "text-fg"}>
                  {s.label}
                </span>
              </li>
            );
          })}
          <li className="mt-auto hidden pt-6 text-xs text-muted lg:block">
            {m.demo.note}
          </li>
        </ol>

        <div className="min-w-0 p-5 sm:p-7 lg:min-h-[540px]">
          {/* The link going in */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1 truncate rounded-xl border border-line bg-bg px-4 py-3 text-sm">
              <span className={typingUrl ? "caret" : ""}>{url}</span>
            </div>
            <span
              className={`btn-primary rounded-xl px-5 py-3 text-center text-sm font-medium ${
                t >= T.read - 300 && t < T.read + 200 ? "scale-95" : ""
              }`}
            >
              {m.demo.create}
            </span>
          </div>

          {/* What Gooidy read */}
          {t >= T.read && (
            <div className="pop-in mt-6 grid gap-4 rounded-xl bg-surface p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {m.demo.sells}
                </p>
                <p className="mt-1 leading-relaxed">
                  {typed(run.summary, T.read + 200)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {m.demo.forWhom}
                </p>
                <p className="mt-1 leading-relaxed">
                  {typed(run.audience, T.read + 600)}
                </p>
              </div>
            </div>
          )}

          {/* Angles and headlines */}
          {t >= T.angles && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {ads.map((a, i) =>
                t >= T.angles + i * 260 ? (
                  <li
                    key={a.id}
                    className="pop-in flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm"
                  >
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                      {angle.name(a.angle)}
                    </span>
                    <span className="truncate">{a.headline}</span>
                  </li>
                ) : null,
              )}
            </ul>
          )}

          {/* Variants of this product share a single display. */}
          {t >= T.design && ads.length > 0 && (
            <div className="mt-5" data-single-product-display="run-demo">
              <div className="mb-3 flex flex-wrap gap-2">
                {ads.map((ad,i) => (
                  <button key={ad.id} type="button" aria-label={ad.headline}
                    aria-pressed={selected === i} onClick={() => setSelected(i)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${selected === i ? "border-accent bg-accent-soft" : "border-line"}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className={`relative aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-lg ${t < T.design + 500 ? "skeleton" : ""}`}>
                {t >= T.design + 500 && (
                  <Image key={ads[selected].id} src={ads[selected].image}
                    alt={ads[selected].headline} fill sizes="240px" className="object-cover" />
                )}
              </div>
            </div>
          )}

          {t >= T.done && (
            <div className="pop-in mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="rounded-full bg-ok-bg px-3 py-1 font-medium text-ok">
                {fmt(run.madeIn ? m.demo.doneIn : m.demo.done, {
                  time: run.madeIn ?? "",
                  angles: ads.length,
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelected(0);
                  setT(-1);
                  setPlay((p) => p + 1);
                }}
                className="text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                {m.demo.replay}
              </button>
            </div>
          )}
          {t < 0 && <div className="h-40" aria-hidden />}
        </div>
      </div>
    </div>
  );
}
