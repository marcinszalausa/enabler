// One vertical ad for the home page phones. Ads are real Gooidy runs from
// the showcase; the Soft Mila clip only fills in when no run has been picked
// yet.

export type FeedAd = {
  productKey: string;
  // A finished 9:16 ad (headline and button already drawn on it)...
  image?: string;
  alt?: string;
  // ...or a short looping clip, with an optional still to show while it loads.
  video?: { src: string; poster?: string };
  // What the run was, for the notes beside the hero phone.
  angle?: string;
  store?: string;
  // How long the run took, e.g. "55 s".
  madeIn?: string;
  format?: string;
  // A finished Gooidy video ad (with its own voiceover and music).
  sound?: boolean;
};

export const FALLBACK_AD: FeedAd = {
  productKey: "softmila.com/products/modest-wrap-cardigan",
  video: {
    src: "/reels/softmila-cardigan.mp4",
    poster: "/reels/softmila-cardigan.jpg",
  },
};
