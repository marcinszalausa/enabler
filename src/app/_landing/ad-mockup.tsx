// Illustrated sample ads for the landing page. Pure CSS, so the page needs
// no image files; swap for real customer ads once we have permission.

export type SampleAd = {
  brand: string;
  headline: string;
  cta: string;
  aspect: "square" | "story";
  // Background gradient and the "product" blob colors.
  from: string;
  to: string;
  blob: string;
  ctaColor: string;
  ctaText: string;
};

export function AdMockup({
  ad,
  className = "",
}: {
  ad: SampleAd;
  className?: string;
}) {
  const story = ad.aspect === "story";
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl p-3 shadow-2xl sm:rounded-3xl sm:p-5 shadow-violet-900/20 ring-1 ring-black/5 ${
        story ? "aspect-[9/16]" : "aspect-square"
      } ${className}`}
      style={{ backgroundImage: `linear-gradient(160deg, ${ad.from}, ${ad.to})` }}
      aria-hidden
    >
      {/* The "product photo": soft shapes standing in for the item. */}
      <div
        className="absolute left-1/2 top-[55%] h-[46%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[42%] blur-[1px]"
        style={{ background: ad.blob }}
      />
      <div
        className="absolute left-[58%] top-[42%] h-[22%] w-[30%] rounded-full opacity-70"
        style={{ background: "rgba(255,255,255,0.55)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/30" />

      <div className="relative flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/90 text-[10px] font-bold text-neutral-900">
          {ad.brand[0]}
        </span>
        <span className="truncate text-xs font-semibold text-white/90">{ad.brand}</span>
        <span className="hidden text-[10px] text-white/70 lg:inline">· Sponsored</span>
      </div>

      <p
        className={`font-display relative font-bold leading-[1.05] text-white drop-shadow ${
          story ? "mt-4 text-lg sm:mt-6 sm:text-2xl" : "mt-2 text-base sm:mt-3 sm:text-xl"
        }`}
      >
        {ad.headline}
      </p>

      <div className="relative mt-auto flex items-end justify-between">
        <span
          className="rounded-full px-3 py-1 text-[11px] font-bold sm:px-4 sm:py-1.5 sm:text-xs"
          style={{ background: ad.ctaColor, color: ad.ctaText }}
        >
          {ad.cta}
        </span>
      </div>
    </div>
  );
}

export const SAMPLE_ADS: SampleAd[] = [
  {
    brand: "Willow Knits",
    headline: "Done with scratchy sweaters?",
    cta: "Shop now",
    aspect: "story",
    from: "#f9a8d4",
    to: "#7c3aed",
    blob: "linear-gradient(135deg,#fde68a,#fb923c)",
    ctaColor: "#ffffff",
    ctaText: "#17122b",
  },
  {
    brand: "Bean & Bloom",
    headline: "Your morning, upgraded.",
    cta: "Order today",
    aspect: "square",
    from: "#fed7aa",
    to: "#9a3412",
    blob: "linear-gradient(135deg,#78350f,#451a03)",
    ctaColor: "#fde047",
    ctaText: "#17122b",
  },
  {
    brand: "Glowlab",
    headline: "Glow without the 10-step routine",
    cta: "Try it",
    aspect: "story",
    from: "#a5f3fc",
    to: "#2563eb",
    blob: "linear-gradient(135deg,#ffffff,#fbcfe8)",
    ctaColor: "#17122b",
    ctaText: "#ffffff",
  },
  {
    brand: "Paws Club",
    headline: "Walks without the pulling.",
    cta: "Learn more",
    aspect: "square",
    from: "#bbf7d0",
    to: "#15803d",
    blob: "linear-gradient(135deg,#f97316,#dc2626)",
    ctaColor: "#ffffff",
    ctaText: "#14532d",
  },
];
