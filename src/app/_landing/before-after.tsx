import Image from "next/image";
import { SectionHeading } from "./chrome";

// The store's own product photo next to ads Gooidy made from it.
export function BeforeAfter({
  photo,
  name,
  url,
  madeIn,
  ads,
}: {
  photo: string;
  name: string;
  url: string;
  // How long the run took, e.g. "55 s".
  madeIn?: string;
  ads: { image: string; alt: string }[];
}) {
  const { hostname, pathname } = new URL(url);
  const store = hostname.replace(/^www\./, "");
  return (
    <section className="reveal mx-auto max-w-6xl px-4 py-24">
      <SectionHeading
        title="From one product photo to ads that sell"
        sub={`On the left is the photo on ${store}. On the right are ads Gooidy made from it, unedited.`}
      />
      <div className="mt-14 grid items-center gap-10 lg:grid-cols-[0.8fr_auto_1.4fr]">
        <figure className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-raised shadow-[0_30px_70px_-40px_rgb(var(--t-shadow)/0.5)]">
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
            </span>
            <span className="min-w-0 flex-1 truncate rounded-md bg-bg px-2.5 py-1 text-xs text-muted">
              {store}
              {pathname}
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- the store's own photo, on any host */}
          <img
            src={photo}
            alt={name}
            loading="lazy"
            className="aspect-[4/5] w-full bg-surface object-cover"
          />
          <figcaption className="px-4 py-3 text-sm">
            <span className="font-medium">{name}</span>
            <span className="block text-xs text-muted">
              Before: the product page
            </span>
          </figcaption>
        </figure>

        <div className="flex flex-col items-center gap-2 text-center text-sm text-muted">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_-10px_var(--t-accent)]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 rotate-90 lg:rotate-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
          {madeIn && <span>{madeIn}</span>}
        </div>

        <div>
          <ul className="stagger grid grid-cols-3 gap-3 sm:gap-4">
            {ads.map((a) => (
              <li key={a.image}>
                <Image
                  src={a.image}
                  alt={a.alt}
                  width={1080}
                  height={1920}
                  sizes="(min-width: 64rem) 200px, 30vw"
                  className="lift aspect-[9/16] w-full rounded-xl border border-line object-cover shadow-[0_20px_50px_-30px_rgb(var(--t-shadow)/0.5)]"
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs text-muted">
            After: {ads.length} of the ads from that run
          </p>
        </div>
      </div>
    </section>
  );
}
