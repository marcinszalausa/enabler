// One vertical ad as it looks in a short-video feed. Home page ads are real
// Gooidy runs from the showcase; the Soft Mila clip only fills in when no
// run has been picked yet.

export type FeedAd = {
  handle: string;
  // A finished 9:16 ad (headline and button already drawn on it)...
  image?: string;
  alt?: string;
  // ...or a short, muted, looping clip with a still to show while it loads.
  video?: { src: string; poster: string };
};

export const FALLBACK_AD: FeedAd = {
  handle: "softmila",
  video: {
    src: "/reels/softmila-cardigan.mp4",
    poster: "/reels/softmila-cardigan.jpg",
  },
};

export function Reel({ ad }: { ad: FeedAd }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#16171d]">
      {ad.video ? (
        <video
          src={ad.video.src}
          poster={ad.video.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by our own ad route
        <img
          src={ad.image}
          alt={ad.alt ?? ""}
          width={1080}
          height={1920}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Finished ads carry their own button at the bottom; only label clips. */}
      {ad.video && (
        <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-3 pt-8 text-sm font-semibold text-white">
          @{ad.handle}{" "}
          <span className="text-xs font-normal text-white/75">· Sponsored</span>
        </p>
      )}
    </div>
  );
}
