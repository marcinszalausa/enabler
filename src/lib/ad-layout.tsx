// The finished ad as a Satori tree: photo, headline, call to action, logo.
// Kept free of server imports so it can be rendered in isolation.

export const AD_SIZES = {
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
} as const;
export type AdAspect = keyof typeof AD_SIZES;

// Copy as Satori draws it, or as an image of it for scripts it can't shape
// (see ad-text.ts). `pad` is the blank margin around the drawn text.
export type AdText =
  | string
  | { src: string; width: number; height: number; pad: number };

export type TextStyle = {
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  color: string;
  align: "start" | "center";
  shadow: boolean;
};

const PAD_X = 72;

export function adTextStyles(aspect: AdAspect, accentTextColor: string) {
  return {
    headline: {
      fontSize: aspect === "9:16" ? 92 : 80,
      lineHeight: 1.1,
      maxWidth: AD_SIZES[aspect].width - PAD_X * 2,
      color: "white",
      align: "start",
      shadow: true,
    },
    cta: {
      fontSize: 44,
      lineHeight: 1.2,
      maxWidth: 640,
      color: accentTextColor,
      align: "start",
      shadow: false,
    },
  } satisfies Record<string, TextStyle>;
}

// Renders copy inside a flex box: text as is, or the image of it with its
// padding pulled back so the text lines up like Satori's would.
export function Copy({ text }: { text: AdText }) {
  if (typeof text === "string") return text;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img
    <img
      src={text.src}
      width={text.width}
      height={text.height}
      style={{ margin: -text.pad }}
      alt=""
    />
  );
}

export type AdLayoutProps = {
  // Null renders only the text layer on a transparent background, to lay
  // over a video.
  photoUrl: string | null;
  aspect: AdAspect;
  headline: AdText;
  cta: AdText;
  // Right-to-left copy (Arabic): text and button sit on the right.
  rtl?: boolean;
  fontFamily: string;
  accentColor: string;
  accentTextColor: string;
  logoUrl: string | null;
};

export function AdLayout(p: AdLayoutProps) {
  const size = AD_SIZES[p.aspect];
  const story = p.aspect === "9:16";
  const padX = PAD_X;

  return (
    <div
      style={{
        ...size,
        display: "flex",
        position: "relative",
        fontFamily: p.fontFamily,
      }}
    >
      {p.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img
        <img
          src={p.photoUrl}
          width={size.width}
          height={size.height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            ...size,
            objectFit: "cover",
          }}
          alt=""
        />
      )}
      <div
        style={{
          // Satori ignores `inset`; give the overlay explicit bounds.
          position: "absolute",
          top: 0,
          left: 0,
          ...size,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: story ? `160px ${padX}px 220px` : `${padX}px`,
          backgroundImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.5) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: p.rtl ? "flex-end" : "flex-start",
            width: size.width - padX * 2,
            color: "white",
            fontSize: story ? 92 : 80,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1,
            textShadow: "0 2px 16px rgba(0,0,0,0.35)",
          }}
        >
          <Copy text={p.headline} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: p.rtl ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              background: p.accentColor,
              color: p.accentTextColor,
              fontSize: 44,
              fontWeight: 700,
              padding: "22px 44px",
              borderRadius: 999,
            }}
          >
            <Copy text={p.cta} />
          </div>
          {p.logoUrl && (
            // A white chip keeps dark and light logos readable on any photo.
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.92)",
                borderRadius: 24,
                padding: "16px 24px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
              <img
                src={p.logoUrl}
                height={72}
                style={{ maxWidth: 300, objectFit: "contain" }}
                alt=""
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
