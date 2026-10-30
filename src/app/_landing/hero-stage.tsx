"use client";

import { useEffect, useRef } from "react";
import { PhoneFeed } from "./phone-feed";
import type { FeedAd } from "./reel";

// Three real ads on three iPhones, set like faces of a hexagon: the feed in
// the middle, single ads turned away on each side. The phones have real
// thickness, and the whole stage leans a few degrees toward the pointer,
// which makes them feel like objects, not images.
// Body thickness in % of width. The real phone is 11.2% (8.75 mm on 78 mm),
// which reads a little heavy on screen.
const DEPTH = 9;
// Ad widths inside the side phones, which only show from 640 px up.
const SIDE = "(min-width: 64rem) 270px, (min-width: 48rem) 225px, 200px";

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
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(el);
    const onMove = (e: PointerEvent) => {
      if (!visible || document.hidden) return;
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
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={stage} className="stage relative mx-auto w-full max-w-5xl" data-product-group="hero">
      <div className="stage-inner relative flex justify-center">
        {left && (
          <div className="stage-side stage-left hidden sm:block">
            <PhoneFeed
              ads={[left]}
              depth={DEPTH}
              sizes={SIDE}
              className="stage-phone w-[200px] md:w-[225px] lg:w-[270px]"
            />
          </div>
        )}
        {right && (
          <div className="stage-side stage-right hidden sm:block">
            <PhoneFeed
              ads={[right]}
              depth={DEPTH}
              sizes={SIDE}
              className="stage-phone w-[200px] md:w-[225px] lg:w-[270px]"
            />
          </div>
        )}
        <PhoneFeed
          ads={feed}
          depth={DEPTH}
          sizes="(min-width: 64rem) 310px, (min-width: 48rem) 290px, (min-width: 40rem) 240px, 250px"
          preload
          className="stage-phone relative w-[250px] sm:w-[240px] md:w-[290px] lg:w-[310px]"
        />
      </div>
    </div>
  );
}
