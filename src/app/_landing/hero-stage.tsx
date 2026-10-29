"use client";

import { useEffect, useRef } from "react";
import { PhoneFeed } from "./phone-feed";
import type { FeedAd } from "./reel";

// Three real ads on three iPhones, set like faces of a hexagon standing on
// glass: the feed in the middle, single ads turned away on each side. The
// whole stage leans a few degrees toward the pointer, which makes the phones
// feel like objects, not images.
export function HeroStage({
  feed,
  left,
  right,
}: {
  feed: FeedAd[];
  left?: FeedAd;
  right?: FeedAd;
}) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (
      !el ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !matchMedia("(pointer: fine)").matches
    )
      return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = e.clientX / innerWidth - 0.5;
        const y = e.clientY / innerHeight - 0.5;
        el.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
      });
    };
    addEventListener("pointermove", onMove);
    return () => {
      removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={stage} className="stage relative mx-auto w-full max-w-3xl">
      <div className="stage-inner relative flex justify-center">
        {left && (
          <div className="stage-side stage-left hidden sm:block">
            <PhoneFeed
              ads={[left]}
              className="w-[210px] md:w-[240px] lg:w-[265px]"
            />
          </div>
        )}
        {right && (
          <div className="stage-side stage-right hidden sm:block">
            <PhoneFeed
              ads={[right]}
              className="w-[210px] md:w-[240px] lg:w-[265px]"
            />
          </div>
        )}
        <PhoneFeed
          ads={feed}
          className="relative z-10 w-[250px] sm:w-[290px] lg:w-[310px]"
        />
        <div className="stage-floor" aria-hidden />
      </div>
    </div>
  );
}
