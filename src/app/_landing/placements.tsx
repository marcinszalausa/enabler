"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { SCREEN } from "./screen";
import { useI18n } from "@/i18n/client";

// One real ad as people will meet it: inside Reels, Stories, the Facebook
// feed and TikTok, with each app's own buttons around it. Only the app
// chrome is drawn here; the ad, its headline and the store are real.
export type PlacementAd = {
  productKey: string;
  story: { image: string; alt: string };
  square: { image: string; alt: string; primaryText: string };
  store: string;
};

const SIZES = "(min-width: 64rem) 230px, (min-width: 40rem) 200px, 44vw";

export function Placements({ ads }: { ads: PlacementAd[] }) {
  const { t } = useI18n();
  const formats = [
    { label: t.feed.reels, render: (ad: PlacementAd) => <Reels ad={ad} /> },
    { label: t.feed.stories, render: (ad: PlacementAd) => <Story ad={ad} /> },
    { label: t.feed.facebook, render: (ad: PlacementAd) => <Feed ad={ad} /> },
    { label: t.feed.tiktok, render: (ad: PlacementAd) => <TikTok ad={ad} /> },
  ];
  return (
    <ul data-product-group="placements" className={`stagger grid gap-x-4 gap-y-10 sm:gap-x-6 ${ads.length === 1 ? "grid-cols-1 justify-items-center" : ads.length === 2 ? "grid-cols-2" : ads.length === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
      {ads.slice(0,4).map((ad,i) => (
        <li key={ad.productKey} data-product-key={ad.productKey} className="flex w-full max-w-[230px] flex-col items-center">
          <div className={`${SCREEN} lift w-full`}>{formats[i].render(ad)}</div>
          <p className="mt-4 text-sm font-medium">{formats[i].label}</p>
        </li>
      ))}
    </ul>
  );
}

// The vertical ad filling the screen, with the app's buttons on top.
function Vertical({ ad, children }: { ad: PlacementAd; children: ReactNode }) {
  return (
    <div className="relative h-full w-full bg-black text-white">
      <Image
        src={ad.story.image}
        alt={ad.story.alt}
        fill
        sizes={SIZES}
        loading="lazy"
        className="object-cover"
      />
      {children}
    </div>
  );
}

function Avatar({ store, ring = false }: { store: string; ring?: boolean }) {
  return (
    <span
      className={`flex h-[7cqw] w-[7cqw] shrink-0 items-center justify-center rounded-full bg-accent text-[3.4cqw] font-semibold uppercase text-white ${ring ? "ring-[0.5cqw] ring-white" : ""}`}
    >
      {store[0]}
    </span>
  );
}

function Rail({ items }: { items: string[] }) {
  return (
    <div className="absolute bottom-[26%] right-[3cqw] flex flex-col items-center gap-[5.5cqw] drop-shadow">
      {items.map((d) => (
        <Glyph key={d} d={d} />
      ))}
    </div>
  );
}

function Reels({ ad }: { ad: PlacementAd }) {
  const { t } = useI18n();
  return (
    <Vertical ad={ad}>
      <p className="absolute left-[4cqw] top-[4cqw] text-[5cqw] font-semibold drop-shadow">
        Reels
      </p>
      <Rail items={[HEART, BUBBLE, PLANE]} />
      <div className="absolute inset-x-0 bottom-[6cqw] px-[4cqw] drop-shadow">
        <div className="flex items-center gap-[2cqw] text-[3.3cqw]">
          <Avatar store={ad.store} />
          <span className="font-semibold">{ad.store}</span>
        </div>
        <p className="mt-[0.8cqw] text-[2.8cqw] text-white/85">
          {t.feed.sponsored}
        </p>
        <p className="mt-[2cqw] flex items-center justify-between rounded-[1.6cqw] bg-white/20 px-[3cqw] py-[1.8cqw] text-[3.2cqw] font-semibold backdrop-blur">
          {t.feed.shopNow} <span aria-hidden>›</span>
        </p>
      </div>
    </Vertical>
  );
}

function Story({ ad }: { ad: PlacementAd }) {
  const { t } = useI18n();
  return (
    <Vertical ad={ad}>
      <div className="absolute inset-x-0 top-[3cqw] px-[3cqw]">
        <span className="block h-[0.6cqw] overflow-hidden rounded-full bg-white/40">
          <span className="block h-full w-2/5 bg-white" />
        </span>
        <div className="mt-[2.4cqw] flex items-center gap-[2cqw] text-[3.3cqw] drop-shadow">
          <Avatar store={ad.store} />
          <span className="font-semibold">{ad.store}</span>
          <span className="text-white/80">{t.feed.sponsored}</span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[6cqw] flex flex-col items-center drop-shadow">
        <span className="text-[3.6cqw]" aria-hidden>
          ⌃
        </span>
        <span className="rounded-full bg-white px-[5cqw] py-[1.6cqw] text-[3.3cqw] font-semibold text-black">
          {t.feed.shopNow}
        </span>
      </div>
    </Vertical>
  );
}

function TikTok({ ad }: { ad: PlacementAd }) {
  const { t } = useI18n();
  return (
    <Vertical ad={ad}>
      <p className="absolute inset-x-0 top-[4cqw] flex justify-center gap-[4cqw] text-[3.6cqw] font-semibold drop-shadow">
        <span className="text-white/70">{t.feed.following}</span>
        <span>{t.feed.forYou}</span>
      </p>
      <div className="absolute bottom-[26%] right-[3cqw] flex flex-col items-center gap-[5.5cqw] drop-shadow">
        <Avatar store={ad.store} ring />
        <Glyph d={HEART} />
        <Glyph d={BUBBLE} />
        <Glyph d={SHARE} />
      </div>
      <div className="absolute inset-x-0 bottom-[6cqw] px-[4cqw] drop-shadow">
        <p className="text-[3.5cqw] font-semibold">@{ad.store}</p>
        <p className="mt-[1cqw] inline-block rounded-[1cqw] bg-white/25 px-[1.6cqw] py-[0.4cqw] text-[2.6cqw]">
          {t.feed.sponsored}
        </p>
        <p className="mt-[2cqw] rounded-[1.6cqw] bg-[#fe2c55] py-[2cqw] text-center text-[3.3cqw] font-semibold">
          {t.feed.shopNow}
        </p>
      </div>
    </Vertical>
  );
}

// The square ad as a sponsored post in the Facebook feed.
function Feed({ ad }: { ad: PlacementAd }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full w-full flex-col bg-white text-[#050505]">
      {/* The app's top bar and the friend post above, left as quiet shapes. */}
      <div className="flex items-center justify-between px-[4cqw] py-[3cqw]">
        <span className="h-[3.2cqw] w-[18cqw] rounded-full bg-[#d8dadf]" />
        <span className="flex gap-[2cqw]">
          <span className="h-[6.5cqw] w-[6.5cqw] rounded-full bg-[#e4e6eb]" />
          <span className="h-[6.5cqw] w-[6.5cqw] rounded-full bg-[#e4e6eb]" />
        </span>
      </div>
      <div className="border-t-[1.5cqw] border-[#e4e6eb]">
        <div className="flex items-center gap-[2cqw] px-[4cqw] py-[2.6cqw]">
          <Avatar store={ad.store} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[3.3cqw] font-semibold">{ad.store}</p>
            <p className="text-[2.7cqw] text-[#65676b]">
              {t.feed.sponsored} · 🌐
            </p>
          </div>
        </div>
        <p className="line-clamp-2 px-[4cqw] pb-[2.4cqw] text-[3.1cqw] leading-snug">
          {ad.square.primaryText}
        </p>
        <div className="relative aspect-square w-full">
          <Image
            src={ad.square.image}
            alt={ad.square.alt}
            fill
            sizes={SIZES}
            loading="lazy"
            className="object-cover"
          />
        </div>
        <div className="flex items-center justify-between gap-[2cqw] bg-[#f0f2f5] px-[4cqw] py-[2.4cqw]">
          <div className="min-w-0 leading-tight">
            <p className="text-[2.6cqw] uppercase text-[#65676b]">{ad.store}</p>
            <p className="truncate text-[3.1cqw] font-semibold">
              {ad.square.alt}
            </p>
          </div>
          <span className="shrink-0 rounded-[1.4cqw] bg-[#e4e6eb] px-[2.6cqw] py-[1.4cqw] text-[3cqw] font-semibold">
            {t.feed.shopNow}
          </span>
        </div>
        <div className="flex justify-around px-[4cqw] py-[2.6cqw] text-[3cqw] text-[#65676b]">
          <span>{t.feed.like}</span>
          <span>{t.feed.comment}</span>
          <span>{t.feed.share}</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden border-t-[1.5cqw] border-[#e4e6eb] px-[4cqw] pt-[2.6cqw]">
        <div className="flex items-center gap-[2cqw]">
          <span className="h-[7cqw] w-[7cqw] rounded-full bg-[#e4e6eb]" />
          <span className="h-[2.6cqw] w-[24cqw] rounded-full bg-[#e4e6eb]" />
        </div>
        <span className="mt-[2.6cqw] block h-[2.4cqw] w-4/5 rounded-full bg-[#eef0f2]" />
        <span className="mt-[2.6cqw] block h-full rounded-[1.5cqw] bg-[#eef0f2]" />
      </div>
    </div>
  );
}

const HEART =
  "M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10Z";
const BUBBLE = "M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z";
const PLANE = "M21 4 10.5 14.5M21 4l-6.5 17-4-6.5L4 10.5 21 4Z";
const SHARE = "M14 5l7 7-7 7v-4c-6 0-9 2-11 5 1-6 4-10 11-11V5Z";

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[6.5cqw] w-[6.5cqw]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
