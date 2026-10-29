// Sample vertical ads for the landing page. The first is a real Soft Mila
// clip; the rest are drawn in CSS until we have more customer videos.

export type SampleReel = {
  handle: string;
  // Caption over the ad; empty when the clip has its own captions.
  hook: string;
  caption: string;
  cta: string;
  likes: number;
  comments: number;
  from: string;
  to: string;
  blob: string;
  // Optional vertical clip in public/reels/ (short, muted, looping), with a
  // still frame to show while it loads.
  video?: { src: string; poster: string };
};

export const REELS: SampleReel[] = [
  {
    handle: "softmila",
    hook: "",
    caption: "The Soft Mila Modal Wrap Cardigan",
    cta: "Shop now",
    likes: 48_200,
    comments: 912,
    from: "#c9d6cf",
    to: "#6b7f75",
    blob: "linear-gradient(135deg,#dfe8e2,#9fb5aa)",
    video: {
      src: "/reels/softmila-cardigan.mp4",
      poster: "/reels/softmila-cardigan.jpg",
    },
  },
  {
    handle: "glowlab",
    hook: "3 steps to glass skin",
    caption: "A simpler routine that works",
    cta: "Try it",
    likes: 31_400,
    comments: 645,
    from: "#d2e3fc",
    to: "#4f6fb8",
    blob: "linear-gradient(135deg,#ffffff,#f3d9e4)",
  },
  {
    handle: "pawsclub",
    hook: "No more pulling on walks",
    caption: "The no-pull harness, vet approved",
    cta: "Get yours",
    likes: 27_900,
    comments: 410,
    from: "#ceead6",
    to: "#3f8a5c",
    blob: "linear-gradient(135deg,#f6ae6b,#d9534f)",
  },
  {
    handle: "beanandbloom",
    hook: "Café coffee, at home",
    caption: "Freshly roasted, shipped in 48 hours",
    cta: "Order now",
    likes: 19_600,
    comments: 288,
    from: "#fde7c8",
    to: "#9c5b2e",
    blob: "linear-gradient(135deg,#6b3e1d,#2b1607)",
  },
];

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// One full-screen vertical ad, the way it looks in a short-video feed.
export function Reel({
  reel,
  rail = true,
}: {
  reel: SampleReel;
  rail?: boolean;
}) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(165deg, ${reel.from}, ${reel.to})`,
      }}
      aria-hidden
    >
      {reel.video ? (
        <video
          src={reel.video.src}
          poster={reel.video.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // The "product": a soft shape standing in for the item.
        <div
          className="absolute left-1/2 top-1/2 h-[36%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-[40%]"
          style={{ background: reel.blob }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

      {reel.hook && (
        <p className="absolute inset-x-0 top-[18%] mx-auto w-fit max-w-[80%] rounded-md bg-white px-2.5 py-1 text-center text-sm font-semibold text-[#202124]">
          {reel.hook}
        </p>
      )}

      {rail && (
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-3 text-[11px] font-medium text-white">
          <span className="flex flex-col items-center">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3.1 4.5 6.9 4.5c2.1 0 3.5 1.1 5.1 3 1.6-1.9 3-3 5.1-3 3.8 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z" />
            </svg>
            {compact.format(reel.likes)}
          </span>
          <span className="flex flex-col items-center">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.1A8.5 8.5 0 1 1 21 11.5z" />
            </svg>
            {compact.format(reel.comments)}
          </span>
        </div>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 p-3 text-white ${rail ? "pr-14" : ""}`}
      >
        <p className="text-sm font-semibold">
          @{reel.handle}{" "}
          <span className="text-[11px] font-normal text-white/75">
            · Sponsored
          </span>
        </p>
        {rail && <p className="mt-0.5 text-xs text-white/85">{reel.caption}</p>}
        <p className="mt-2 rounded-md bg-white/95 px-3 py-1.5 text-center text-xs font-semibold text-[#202124]">
          {reel.cta}
        </p>
      </div>
    </div>
  );
}
