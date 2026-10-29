"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HomeIndicator, IPhone, StatusBar } from "./iphone";
import type { FeedAd } from "./reel";
import { SCREEN } from "./screen";
import { angleName } from "@/lib/angles";

const IMAGE_MS = 3800;
// Moves on even if a video stalls or never fires "ended".
const VIDEO_MAX_MS = 15000;

// Real ads in an iPhone, one at a time, the way they play in a vertical feed.
// The ad area has the ads' own 9:16 shape, so each one fills it edge to edge
// with nothing cropped; the status bar and tab bar take the rest of the
// taller screen, as they do in the apps. Videos play one at a time, only
// while the phone is on screen, and can be unmuted. With `bare`, the same
// feed plays in a plain rounded card, without the phone around it.
export function PhoneFeed({
  ads,
  notes = false,
  depth = 0,
  sizes,
  preload = false,
  bare = false,
  className = "",
}: {
  ads: FeedAd[];
  notes?: boolean;
  depth?: number;
  // The ad area's width on screen, for picking the image size.
  sizes: string;
  // The hero phone's first ad is the first thing people see.
  preload?: boolean;
  bare?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const reduceMotion = useRef(false);

  // The first ad repeats at the end so the last one slides on to it; then
  // the track jumps back to the start without animating.
  const looping = ads.length > 1;
  const items = looping ? [...ads, ads[0]] : ads;
  const current = ads[index % ads.length];

  const next = () => {
    setAnimate(true);
    setIndex((i) =>
      reduceMotion.current ? (i + 1) % ads.length : Math.min(i + 1, ads.length),
    );
  };

  useEffect(() => {
    reduceMotion.current = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Plays the ad in view and pauses the rest, then schedules the next one.
  useEffect(() => {
    videos.current.forEach((v, k) => {
      if (!v) return;
      if (k === index && visible) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else v.pause();
    });
    if (!visible || !looping) return;
    const t = setTimeout(next, items[index].video ? VIDEO_MAX_MS : IMAGE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- next only reads refs and setters
  }, [index, visible, looping]);

  const screen = (
    <div className="relative aspect-[9/16] w-full shrink-0 overflow-hidden bg-[#16171d]">
      <div
        className={`h-full ${animate ? "transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]" : ""}`}
        style={{ transform: `translateY(-${index * 100}%)` }}
        onTransitionEnd={() => {
          if (index === ads.length) {
            setAnimate(false);
            setIndex(0);
          }
        }}
      >
        {items.map((ad, k) => (
          <div key={k} className="relative h-full w-full">
            {ad.video ? (
              <video
                ref={(v) => {
                  videos.current[k] = v;
                }}
                src={ad.video.src}
                poster={ad.video.poster}
                muted={muted}
                loop={!looping}
                playsInline
                // Full-size clips are heavy: only the one on screen
                // loads, and the next one gets ready to start.
                preload={
                  !visible
                    ? "none"
                    : k === index
                      ? "auto"
                      : k === index + 1
                        ? "metadata"
                        : "none"
                }
                onEnded={k === index ? next : undefined}
                className="absolute inset-0 h-full w-full object-cover"
                aria-label={ad.alt}
              />
            ) : (
              <Image
                src={ad.image!}
                alt={ad.alt ?? ""}
                fill
                sizes={sizes}
                preload={preload && k === 0}
                loading={k <= index + 1 ? "eager" : "lazy"}
                className="object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {/* Story-style progress and the feed's side actions. Ads carry
                their own headline, button and logo, so nothing else covers them. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-[3cqw] pt-[2cqw]">
        {looping && (
          <div className="flex gap-[1cqw]">
            {ads.map((_, k) => (
              <span
                key={k}
                className="h-[0.7cqw] flex-1 overflow-hidden rounded-full bg-white/35 shadow-[0_0_2px_rgb(0_0_0/0.3)]"
              >
                <span
                  className={`block h-full rounded-full bg-white transition-[width] duration-500 ${k <= index % ads.length ? "w-full" : "w-0"}`}
                />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-[24%] right-[2.6cqw] flex flex-col items-center gap-[5cqw] text-white drop-shadow">
        <Icon d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10Z" />
        <Icon d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z" />
        <Icon d="M21 4 10.5 14.5M21 4l-6.5 17-4-6.5L4 10.5 21 4Z" />
      </div>
      {current.sound && (
        <button
          type="button"
          onClick={() => {
            videos.current.forEach((v) => v && (v.muted = !muted));
            setMuted(!muted);
          }}
          className="absolute bottom-[3cqw] right-[3cqw] z-10 flex h-[8cqw] w-[8cqw] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[4.4cqw]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
            {muted ? (
              <path d="m16 9 5 6m0-6-5 6" />
            ) : (
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            )}
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div ref={root} className={`relative ${className}`}>
      {notes && <Notes ad={current} key={index % ads.length} />}
      {bare ? (
        <div className={SCREEN}>{screen}</div>
      ) : (
        <IPhone depth={depth}>
          <div className="flex h-full flex-col">
            <div className="h-[12.4cqw] shrink-0">
              <StatusBar />
            </div>

            {screen}

            {/* App tab bar above the home indicator. */}
            <div className="relative flex-1 bg-black">
              <div className="flex items-start justify-around px-[4cqw] pt-[3.2cqw] text-white">
                <Icon d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4v-9.5Z" small />
                <Icon
                  d="M10.8 18.2a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4ZM20.5 20.5l-4.6-4.6"
                  small
                />
                <Icon
                  d="M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5ZM12 8v8m-4-4h8"
                  small
                />
                <Icon
                  d="M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5ZM10 9.2v5.6l4.8-2.8L10 9.2Z"
                  small
                />
                <Icon
                  d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5a7.5 7.5 0 0 1 15 0"
                  small
                />
              </div>
              <HomeIndicator />
            </div>
          </div>
        </IPhone>
      )}
    </div>
  );
}

function Icon({ d, small = false }: { d: string; small?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={small ? "h-[5.8cqw] w-[5.8cqw]" : "h-[7.4cqw] w-[7.4cqw]"}
      fill="none"
      stroke="currentColor"
      strokeWidth={small ? 1.8 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

// Glass notes beside the hero phone, describing the ad on screen. Every
// fact comes from the run itself.
function Notes({ ad }: { ad: FeedAd }) {
  const facts = [
    ad.angle && { label: "Ad angle", value: angleName(ad.angle) },
    { label: "Format", value: ad.format ?? "9:16 · Reels, Stories, TikTok" },
    ad.store && {
      label: ad.madeIn ? `Made in ${ad.madeIn} from` : "Made from",
      value: ad.store,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  const spots = [
    "float-a -left-[11.5rem] top-[14%]",
    "float-b -right-[11rem] top-[44%]",
    "float-a -left-[10rem] bottom-[16%]",
  ];
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 hidden xl:block"
      aria-hidden
    >
      {facts.map((f, k) => (
        <div
          key={f.label}
          className={`glass angle-in absolute w-52 rounded-2xl px-4 py-3 ${spots[k]}`}
        >
          <p className="text-xs text-muted">{f.label}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-fg">
            {f.value}
          </p>
        </div>
      ))}
    </div>
  );
}
