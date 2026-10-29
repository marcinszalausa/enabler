import Link from "next/link";
import { FALLBACK_AD, Reel, type FeedAd } from "./_landing/reel";
import { getShowcase } from "@/lib/showcase";
import {
  THEME_BY_TIME,
  Nav,
  UrlForm,
  SectionHeading,
  Footer,
} from "./_landing/chrome";
import { AngleExplorer } from "./_landing/angle-explorer";
import { Reveal } from "./_landing/reveal";

export const metadata = {
  title: "Gooidy · Ads from a single link",
  description:
    "Paste a product link and Gooidy creates ready-to-run ads for TikTok, Instagram and Facebook in about two minutes. Start free.",
};

const STEPS = [
  {
    title: "Paste a link",
    body: "Add a product page or your store. Gooidy reads what you sell, who it's for and why people buy it.",
  },
  {
    title: "Get your ads",
    body: "Five ad ideas with headlines, copy and images, in vertical and square sizes, using your logo and colors.",
  },
  {
    title: "Publish",
    body: "Download the ones you like and run them on TikTok, Instagram and Facebook. Direct publishing is coming soon.",
  },
];

const FEATURES = [
  {
    title: "Brand brief from your site",
    body: "Tone, audience and selling points, pulled from your page automatically.",
    icon: "M4 6h16M4 12h10M4 18h7",
  },
  {
    title: "Several angles per run",
    body: "Problem and solution, social proof, offer and more, so you can test what works.",
    icon: "M12 3v18M3 12h18",
  },
  {
    title: "Every placement",
    body: "9:16 for Reels, Stories, TikTok and Shorts. 1:1 for the feed.",
    icon: "M7 3h10v18H7z",
  },
  {
    title: "Your brand kit",
    body: "Set your logo, button color and font once. Every ad follows it.",
    icon: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-1-1.2-1-2.2 0-.8.7-1.3 1.5-1.3H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    credits: "100 credits to start",
    perks: ["About 50 ads", "Brand kit", "Download every ad"],
  },
  {
    name: "Starter",
    price: "$29",
    credits: "300 credits every month",
    perks: ["About 150 ads a month", "Everything in Free", "Cancel anytime"],
    featured: true,
  },
  {
    name: "Growth",
    price: "$79",
    credits: "1,000 credits every month",
    perks: [
      "About 500 ads a month",
      "Everything in Starter",
      "Priority support",
    ],
  },
];

const FAQ = [
  {
    q: "What do I need to start?",
    a: "A link to your product or store. Gooidy works with Shopify, WooCommerce, Wix, Squarespace and most online shops.",
  },
  {
    q: "What is a credit?",
    a: "One credit makes one ad image. Each run makes five ads in two sizes, so it uses 10 credits.",
  },
  {
    q: "Do I need design experience?",
    a: "No. Gooidy writes the copy and designs the ads. You choose the ones you like.",
  },
  {
    q: "Where can I use the ads?",
    a: "Anywhere you advertise: TikTok, Instagram, Facebook, YouTube Shorts and more.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month to month, and you keep access until the end of the period you paid for.",
  },
];

// Light from 7:00 to 19:00 on the visitor's own clock, dark otherwise, unless
// they picked one with the toggle (saved on their device). ?theme=light|dark
// forces one. Inline so it runs before the page paints.
export default async function Home() {
  const ads = await feedAds();
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <script dangerouslySetInnerHTML={{ __html: THEME_BY_TIME }} />
      <Nav />
      <main className="flex-1">
        <Hero ads={ads} />
        <WorksWith />
        <HowItWorks />
        <Angles />
        {ads.some((a) => a.image) && <Examples ads={ads} />}
        <Features />
        <Compare />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <Reveal />
    </div>
  );
}

// Up to four real 9:16 ads from the showcase: one per product first, then
// more angles. Falls back to the Soft Mila clip before any run is picked.
async function feedAds(): Promise<FeedAd[]> {
  const runs = await getShowcase();
  const stories = runs.map((r) =>
    r.ads
      .filter((a) => a.aspect === "9:16")
      .map((a) => ({
        handle: r.store.split(".")[0],
        image: `/api/creatives/${a.id}/image`,
        alt: a.headline,
      })),
  );
  const ads: FeedAd[] = [];
  for (
    let round = 0;
    ads.length < 4 && stories.some((s) => s[round]);
    round++
  ) {
    for (const s of stories) if (s[round] && ads.length < 4) ads.push(s[round]);
  }
  return ads.length ? ads : [FALLBACK_AD];
}

function Hero({ ads }: { ads: FeedAd[] }) {
  return (
    <section className="hero-bg">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-sm text-muted shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            AI ads for small businesses
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Ads that sell, from a single{" "}
            <span className="text-accent">link</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-muted lg:mx-0">
            Paste your product page. Gooidy writes the copy, designs the ads and
            sizes them for TikTok, Instagram and Facebook in about two minutes.
          </p>
          <div className="mt-8 flex justify-center lg:justify-start">
            <UrlForm id="url-top" />
          </div>
          <p className="mt-3 text-sm text-muted">
            Free to start. No credit card needed.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <Phone ads={ads} />
        </div>
      </div>
    </section>
  );
}

// A phone that steps through real ads, like a short-video feed.
function Phone({ ads }: { ads: FeedAd[] }) {
  // The feed animation steps through 4 slots, then loops back to the first.
  const slots = Array.from({ length: 4 }, (_, i) => ads[i % ads.length]);
  const feed = [...slots, slots[0]];
  return (
    <div className="h-[540px] w-[270px] rounded-[2.5rem] border border-line bg-[#16171d] p-2 shadow-2xl shadow-accent/10 sm:h-[600px] sm:w-[300px]">
      <div className="relative h-full w-full overflow-hidden rounded-[2rem]">
        <div className="feed-scroll h-[500%]">
          {feed.map((ad, i) => (
            <div key={i} className="h-[20%]">
              <Reel ad={ad} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorksWith() {
  return (
    <section className="border-y border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted">Works with any online store</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-base font-semibold text-muted/80">
          <span>Shopify</span>
          <span>WooCommerce</span>
          <span>Wix</span>
          <span>Squarespace</span>
          <span>BigCommerce</span>
        </div>
      </div>
    </section>
  );
}

function Angles() {
  return (
    <section
      id="angles"
      className="reveal mx-auto max-w-6xl scroll-mt-16 px-4 py-20"
    >
      <SectionHeading
        title="One product, many ways to sell it"
        sub="Every run gives you different ad angles. Tap one to see how the same cardigan is pitched."
      />
      <div className="mt-12">
        <AngleExplorer photo="/reels/softmila-still.jpg" />
      </div>
    </section>
  );
}

const COMPARE = [
  ["Time to first ads", "1–2 weeks", "Hours", "About 2 minutes"],
  ["Cost for 10 ads", "$500+", "Your evening", "Included in your plan"],
  ["New angles to test", "Extra fee", "Hard", "Every run"],
  ["Sizes for every feed", "Extra fee", "Manual resizing", "Automatic"],
];

function Compare() {
  return (
    <section className="reveal mx-auto max-w-4xl px-4 pb-20">
      <SectionHeading title="How Gooidy compares" />
      <div className="mt-10 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface">
              <th className="px-5 py-4 font-medium text-muted"></th>
              <th className="px-5 py-4 font-medium text-muted">Agency</th>
              <th className="px-5 py-4 font-medium text-muted">
                Do it yourself
              </th>
              <th className="px-5 py-4 font-semibold text-accent">Gooidy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {COMPARE.map(([label, agency, diy, us]) => (
              <tr key={label}>
                <td className="px-5 py-4 font-medium">{label}</td>
                <td className="px-5 py-4 text-muted">{agency}</td>
                <td className="px-5 py-4 text-muted">{diy}</td>
                <td className="px-5 py-4 font-medium">{us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 bg-surface py-20">
      <div className="reveal mx-auto max-w-6xl px-4">
        <SectionHeading
          title="How it works"
          sub="From link to ready-to-run ads in three steps."
        />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-line bg-bg p-6"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Examples({ ads }: { ads: FeedAd[] }) {
  return (
    <section className="reveal mx-auto max-w-6xl px-4 py-20">
      <SectionHeading
        title="Made for the feed"
        sub="Real, unedited ads Gooidy made from Soft Mila product links."
      />
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {ads.map((ad, i) => (
          <div
            key={i}
            className="aspect-[9/16] overflow-hidden rounded-2xl border border-line"
          >
            <Reel ad={ad} />
          </div>
        ))}
      </div>
      <p className="mt-8 text-center">
        <Link
          href="/use-cases"
          className="text-sm font-medium text-accent hover:underline"
        >
          See every ad, angle and size →
        </Link>
      </p>
    </section>
  );
}

function Features() {
  return (
    <section className="reveal mx-auto max-w-6xl px-4 pb-20">
      <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={f.icon} />
            </svg>
            <h3 className="mt-4 font-medium">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 bg-surface py-20">
      <div className="reveal mx-auto max-w-6xl px-4">
        <SectionHeading
          title="Simple pricing"
          sub="Start free. Upgrade when you need more ads."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-bg p-7 ${
                plan.featured ? "border-accent border-2" : "border-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{plan.name}</h3>
                {plan.featured && (
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-4">
                <span className="text-4xl font-medium">{plan.price}</span>
                {plan.price !== "$0" && (
                  <span className="text-muted"> / month</span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted">{plan.credits}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    {perk}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className={`mt-8 rounded-xl px-5 py-2.5 text-center text-sm font-medium transition hover:brightness-110 ${
                  plan.featured
                    ? "dark-accent-text bg-accent text-white"
                    : "border border-line text-fg hover:bg-surface"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section
      id="faq"
      className="reveal mx-auto max-w-3xl scroll-mt-16 px-4 py-20"
    >
      <SectionHeading title="Frequently asked questions" />
      <div className="mt-10 divide-y divide-line border-y border-line">
        {FAQ.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {item.q}
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-line bg-surface px-4 py-20">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
          Create your first ads today
        </h2>
        <p className="mt-3 text-lg text-muted">
          100 free credits. No credit card needed.
        </p>
        <div className="mt-8 flex w-full justify-center">
          <UrlForm id="url-bottom" />
        </div>
      </div>
    </section>
  );
}
