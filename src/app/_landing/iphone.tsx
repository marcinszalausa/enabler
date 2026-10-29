import type { ReactNode } from "react";

// A current flagship iPhone, drawn in CSS so it stays sharp at any size and
// costs nothing to load. Everything is sized in container units (cqw) of the
// phone's own width, so proportions hold from a thumbnail to the hero:
// a 71.9 × 150 mm body, thin even bezels, a 19.5:9 screen with Apple's corner
// radius, the Dynamic Island, and the side buttons including Camera Control.
export function IPhone({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`@container ${className}`}>
      <div className="iphone-frame relative aspect-[71.9/150] rounded-[16.6cqw] p-[1.25cqw]">
        {/* Left: Action button, volume up, volume down. */}
        <span className="iphone-key left-[-0.75cqw] top-[18.5%] h-[5.5%]" />
        <span className="iphone-key left-[-0.75cqw] top-[27%] h-[9.5%]" />
        <span className="iphone-key left-[-0.75cqw] top-[38.5%] h-[9.5%]" />
        {/* Right: side button and the flush Camera Control. */}
        <span className="iphone-key right-[-0.75cqw] top-[30%] h-[14%]" />
        <span className="iphone-key iphone-key-flush right-[-0.45cqw] top-[61%] h-[8%]" />

        <div className="iphone-bezel h-full w-full rounded-[15.4cqw] p-[2.9cqw]">
          <div className="relative h-full w-full overflow-hidden rounded-[12.6cqw] bg-black [transform:translateZ(0)]">
            {children}
            {/* Dynamic Island, with the front camera's lens on its right. */}
            <div className="pointer-events-none absolute left-1/2 top-[2.55cqw] z-20 flex h-[8.9cqw] w-[29cqw] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[2.6cqw]">
              <span className="h-[3.2cqw] w-[3.2cqw] rounded-full bg-[radial-gradient(circle_at_35%_35%,#3a3f5c,#0b0c14_60%)]" />
            </div>
            {/* Faint glass reflection. */}
            <div className="iphone-glare pointer-events-none absolute inset-0 z-30" />
          </div>
        </div>
      </div>
    </div>
  );
}

// The status bar as iOS draws it, sized for the space beside the island.
export function StatusBar({ time = "9:41" }: { time?: string }) {
  return (
    <div className="flex h-full items-center justify-between px-[7.5cqw] pt-[0.6cqw] text-white">
      <span className="w-[20cqw] text-center text-[4.1cqw] font-semibold tracking-tight">
        {time}
      </span>
      <span className="flex w-[20cqw] items-center justify-center gap-[1.3cqw]">
        {/* Signal */}
        <svg
          viewBox="0 0 18 12"
          className="h-[3cqw]"
          fill="currentColor"
          aria-hidden
        >
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        {/* Wi-Fi */}
        <svg
          viewBox="0 0 16 12"
          className="h-[3cqw]"
          fill="currentColor"
          aria-hidden
        >
          <path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.8 10.8 0 0 0 8 .4C5.2.4 2.5 1.5.5 3.4l1.2 1.3A9 9 0 0 1 8 2.2Z" />
          <path d="M8 5.8c1.4 0 2.7.5 3.7 1.4l1.2-1.3A7.2 7.2 0 0 0 8 4c-1.8 0-3.6.7-4.9 1.9l1.2 1.3c1-.9 2.3-1.4 3.7-1.4Z" />
          <path d="M8 9.3c.5 0 .9.2 1.2.4L8 11.6 6.8 9.7c.3-.3.7-.4 1.2-.4Z" />
        </svg>
        {/* Battery */}
        <svg viewBox="0 0 27 13" className="h-[3.1cqw]" aria-hidden>
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="12"
            rx="3.6"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".4"
          />
          <rect
            x="2.2"
            y="2.2"
            width="17"
            height="8.6"
            rx="2.2"
            fill="currentColor"
          />
          <path
            d="M25 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1Z"
            fill="currentColor"
            fillOpacity=".45"
          />
        </svg>
      </span>
    </div>
  );
}

// iOS home indicator.
export function HomeIndicator({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`absolute bottom-[2.1cqw] left-1/2 z-20 h-[1.35cqw] w-[36cqw] -translate-x-1/2 rounded-full ${dark ? "bg-black/80" : "bg-white/90"}`}
      aria-hidden
    />
  );
}
