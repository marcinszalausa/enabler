// The finished ad as a Satori tree: photo, headline, call to action, logo.
// Kept free of server imports so it can be rendered in isolation.

export const AD_SIZES = {
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
} as const;
export type AdAspect = keyof typeof AD_SIZES;

export type AdLayoutProps = {
  photoUrl: string;
  aspect: AdAspect;
  headline: string;
  cta: string;
  fontFamily: string;
  accentColor: string;
  accentTextColor: string;
  logoUrl: string | null;
};

export function AdLayout(p: AdLayoutProps) {
  const size = AD_SIZES[p.aspect];
  const story = p.aspect === "9:16";
  const padX = 72;

  return (
    <div
      style={{
        ...size,
        display: "flex",
        position: "relative",
        fontFamily: p.fontFamily,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
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
            width: size.width - padX * 2,
            color: "white",
            fontSize: story ? 92 : 80,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1,
            textShadow: "0 2px 16px rgba(0,0,0,0.35)",
          }}
        >
          {p.headline}
        </div>
        <div
          style={{
            display: "flex",
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
            {p.cta}
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
