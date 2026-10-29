// Text layers for video ads as Satori trees, each a transparent 1080x1920
// frame laid over the footage. Kept free of server imports like ad-layout.

import { AD_SIZES, AdLayout, type AdLayoutProps } from "@/lib/ad-layout";

const SIZE = AD_SIZES["9:16"];
const PAD_X = 72;

// The headline over the opening seconds, where the hook has to land.
export function HookLayer(p: { headline: string; fontFamily: string }) {
  return (
    <div
      style={{
        ...SIZE,
        display: "flex",
        flexDirection: "column",
        fontFamily: p.fontFamily,
        padding: `160px ${PAD_X}px 0`,
        backgroundImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width: SIZE.width - PAD_X * 2,
          color: "white",
          fontSize: 92,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -1,
          textShadow: "0 2px 16px rgba(0,0,0,0.35)",
        }}
      >
        {p.headline}
      </div>
    </div>
  );
}

// One phrase of the voiceover, low in the frame but above the area the
// Reels and TikTok buttons cover.
export function CaptionLayer(p: { text: string; fontFamily: string }) {
  return (
    <div
      style={{
        ...SIZE,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
        fontFamily: p.fontFamily,
        paddingBottom: 560,
      }}
    >
      <div
        style={{
          display: "flex",
          maxWidth: SIZE.width - PAD_X * 2,
          textAlign: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.2,
          padding: "14px 30px",
          borderRadius: 20,
          background: "rgba(0,0,0,0.55)",
        }}
      >
        {p.text}
      </div>
    </div>
  );
}

// The closing frame: headline, call to action and logo over dimmed footage.
export function EndCardLayer(p: Omit<AdLayoutProps, "photoUrl" | "aspect">) {
  return (
    <div
      style={{
        ...SIZE,
        display: "flex",
        position: "relative",
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <AdLayout {...p} photoUrl={null} aspect="9:16" />
    </div>
  );
}
