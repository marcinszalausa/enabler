// Sample short-form ads for the landing page, drawn in CSS so the page needs
// no media files. Swap for real customer ads once we have permission.
import { Ticker } from "./ticker";

export type SampleReel = {
  handle: string;
  hook: string;
  caption: string;
  cta: string;
  likes: number;
  comments: number;
  shares: number;
  from: string;
  to: string;
  blob: string;
};

export const REELS: SampleReel[] = [
  {
    handle: "willowknits",
    hook: "POV: you found a sweater that doesn't itch 😮‍💨",
    caption: "Softest thing you'll wear all winter #cozy #fyp",
    cta: "Shop now",
    likes: 482_300,
    comments: 3_912,
    shares: 21_400,
    from: "#ff7eb3",
    to: "#6a11cb",
    blob: "linear-gradient(135deg,#ffe29f,#ff9a3c)",
  },
  {
    handle: "glowlab",
    hook: "Wait for it… 3 steps → glass skin ✨",
    caption: "Dermatologists hate how simple this is #skincare",
    cta: "Try it",
    likes: 1_204_000,
    comments: 8_450,
    shares: 64_100,
    from: "#00f2fe",
    to: "#4f46e5",
    blob: "linear-gradient(135deg,#ffffff,#fbc2eb)",
  },
  {
    handle: "pawsclub",
    hook: "My dog stopped pulling in 1 walk 🐕",
    caption: "No-pull harness, vet approved #dogsoftiktok",
    cta: "Get yours",
    likes: 736_900,
    comments: 5_120,
    shares: 33_800,
    from: "#a8ff78",
    to: "#078c5c",
    blob: "linear-gradient(135deg,#ff6a00,#ee0979)",
  },
  {
    handle: "beanandbloom",
    hook: "Coffee that tastes like a café. At home. ☕",
    caption: "Freshly roasted, shipped in 48h #coffeetok",
    cta: "Order now",
    likes: 298_500,
    comments: 2_340,
    shares: 12_900,
    from: "#f6d365",
    to: "#9a3412",
    blob: "linear-gradient(135deg,#6b3e1d,#2b1607)",
  },
];

function Icon({ d, filled = false }: { d: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 drop-shadow"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const HEART =
  "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3.1 4.5 6.9 4.5c2.1 0 3.5 1.1 5.1 3 1.6-1.9 3-3 5.1-3 3.8 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z";
const BUBBLE =
  "M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.1A8.5 8.5 0 1 1 21 11.5z";
const SHARE = "M14 4l7 7-7 7v-4c-6 0-9 2-11 6 1-6 4-11 11-12V4z";

// One full-screen vertical ad, the way it looks in the feed.
export function Reel({
  reel,
  live = false,
  compact = false,
}: {
  reel: SampleReel;
  live?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundImage: `linear-gradient(165deg, ${reel.from}, ${reel.to})` }}
      aria-hidden
    >
      {/* The "product": soft shapes standing in for the item. */}
      <div
        className="reel-float absolute left-1/2 top-[52%] h-[38%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[42%]"
        style={{ background: reel.blob }}
      />
      <div className="absolute left-[56%] top-[40%] h-[16%] w-[26%] rounded-full bg-white/45 blur-[1px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />

      {/* TikTok-style hook caption */}
      <div className={`absolute inset-x-0 flex justify-center px-4 ${compact ? "top-[14%]" : "top-[19%]"}`}>
        <p
          className={`font-display max-w-[85%] rounded-lg bg-white px-2.5 py-1 text-center font-extrabold leading-tight text-black ${
            compact ? "text-xs" : "text-sm sm:text-base"
          }`}
        >
          {reel.hook}
        </p>
      </div>

      {/* Right action rail */}
      {!compact && (
        <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4 text-white">
          <div className="relative mb-1">
            <div
              className="h-10 w-10 rounded-full border-2 border-white"
              style={{ background: reel.blob }}
            />
            <span className="absolute -bottom-2 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#fe2c55] text-[11px] font-bold leading-none">
              +
            </span>
          </div>
          <div className="flex flex-col items-center text-[#fe2c55]">
            <Icon d={HEART} filled />
            <span className="text-[11px] font-semibold text-white">
              <Ticker start={reel.likes} every={live ? 900 : 1e9} />
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Icon d={BUBBLE} />
            <span className="text-[11px] font-semibold">
              <Ticker start={reel.comments} step={3} every={live ? 1400 : 1e9} />
            </span>
          </div>
          <div className="flex flex-col items-center">
            <Icon d={SHARE} filled />
            <span className="text-[11px] font-semibold">
              <Ticker start={reel.shares} step={9} every={live ? 1100 : 1e9} />
            </span>
          </div>
        </div>
      )}

      {/* Bottom caption + CTA */}
      <div className={`absolute inset-x-0 bottom-0 text-white ${compact ? "p-2.5" : "p-3.5 pr-16"}`}>
        <p className={`font-bold ${compact ? "text-[11px]" : "text-sm"}`}>
          @{reel.handle}{" "}
          <span className="rounded bg-white/20 px-1 py-px text-[10px] font-medium">
            Sponsored
          </span>
        </p>
        {!compact && <p className="mt-1 line-clamp-2 text-xs text-white/85">{reel.caption}</p>}
        <div
          className={`mt-2 flex items-center justify-between rounded-md bg-[#fe2c55] font-bold ${
            compact ? "px-2 py-1 text-[10px]" : "px-3 py-2 text-xs"
          }`}
        >
          {reel.cta}
          <span>›</span>
        </div>
      </div>
    </div>
  );
}
