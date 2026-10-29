"use client";

import { useState } from "react";

// One product, several ad angles: shows visitors what a single run gives them.
const ANGLES = [
  {
    name: "Problem → solution",
    headline: "Done with scratchy cardigans?",
    body: "Silky modal that feels like nothing at all. Wear it all day, sleep in it if you like.",
    cta: "Shop now",
  },
  {
    name: "Lifestyle",
    headline: "Made for your softest hours.",
    body: "Slow mornings, warm coffee and the cardigan you'll reach for every time.",
    cta: "Discover",
  },
  {
    name: "Social proof",
    headline: "The cardigan everyone asks about.",
    body: "Soft, easy and made to be worn on repeat. See why it gets so many compliments.",
    cta: "See reviews",
  },
  {
    name: "Offer",
    headline: "Free shipping, this week only.",
    body: "Your new everyday layer, delivered free. Easy returns if it isn't love.",
    cta: "Get the deal",
  },
  {
    name: "Feature focus",
    headline: "Silky modal. Easy drape.",
    body: "Breathable, soft and wrinkle-resistant. Looks put together with zero effort.",
    cta: "Learn more",
  },
];

export function AngleExplorer({ photo }: { photo: string }) {
  const [active, setActive] = useState(0);
  const angle = ANGLES[active];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        role="tablist"
        aria-label="Ad angles"
      >
        {ANGLES.map((a, i) => (
          <button
            key={a.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-xl border px-4 py-2.5 text-left text-sm transition-colors lg:px-5 lg:py-4 lg:text-base ${
              i === active
                ? "border-accent bg-accent/[0.06] text-fg"
                : "border-line text-muted hover:border-fg/30 hover:text-fg"
            }`}
          >
            <span className="font-medium">{a.name}</span>
            <span
              className={`text-sm transition-opacity ${i === active ? "text-accent opacity-100" : "opacity-0"}`}
              aria-hidden
            >
              →
            </span>
          </button>
        ))}
      </div>

      {/* A feed post preview that updates with the chosen angle. */}
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-line bg-bg shadow-lg">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dfe8e2] text-xs font-semibold text-[#3f5148]">
            SM
          </span>
          <div className="leading-tight">
            <p className="text-sm font-medium">softmila</p>
            <p className="text-xs text-muted">Sponsored</p>
          </div>
        </div>
        <div className="relative aspect-square overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static poster */}
          <img
            src={photo}
            alt="Soft Mila wrap cardigan"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          <p
            key={angle.headline}
            className="angle-in absolute inset-x-0 bottom-0 p-6 text-2xl font-semibold leading-snug text-white sm:text-3xl"
          >
            {angle.headline}
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <p key={angle.body} className="angle-in text-sm text-muted">
            {angle.body}
          </p>
          <span className="shrink-0 rounded-lg bg-surface px-3 py-2 text-sm font-medium">
            {angle.cta}
          </span>
        </div>
      </div>
    </div>
  );
}
