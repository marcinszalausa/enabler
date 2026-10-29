import Link from "next/link";
import { REELS, Reel, type SampleReel } from "./_landing/reel";
import { Ticker } from "./_landing/ticker";

export const metadata = {
  title: "Gooidy · Ads people don't scroll past",
  description:
    "Paste a product link and Gooidy makes scroll-stopping ads for TikTok, Reels and Shorts in about two minutes. Start free.",
};

const HOOKS = [
  "POV:",
  "Wait for it…",
  "3 reasons why",
  "Before → After",
  "Unboxing",
  "Nobody talks about this",
  "Problem → Fix",
  "I tried it so you don't have to",
  "Stop scrolling if…",
  "Made for you",
];

const STEPS = [
  {
    n: "01",
    title: "Drop your link",
    body: "Any product page or store. Gooidy reads it like a marketer: what you sell, who it's for, why they'll want it.",
  },
  {
    n: "02",
    title: "Get a batch of ads",
    body: "Five hooks, five angles, written and designed for you. Vertical for TikTok, Reels and Shorts, square for the feed.",
  },
  {
    n: "03",
    title: "Post and watch it grow",
    body: "Keep the winners and post them. One-tap publishing to Meta and TikTok is on the way.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "forever",
    credits: "100 credits to start",
    perks: ["About 50 ads", "Brand kit", "Download everything"],
  },
  {
    name: "Starter",
    price: "$29",
    note: "/month",
    credits: "300 credits every month",
    perks: ["About 150 ads a month", "Everything in Free", "Cancel anytime"],
    featured: true,
  },
  {
    name: "Growth",
    price: "$79",
    note: "/month",
    credits: "1,000 credits every month",
    perks: ["About 500 ads a month", "Everything in Starter", "Priority support"],
  },
];

const FAQ = [
  {
    q: "What do I need to start?",
    a: "Just a link to your product or store. Gooidy works with Shopify, WooCommerce, Wix, Squarespace and most online shops.",
  },
  {
    q: "What's a credit?",
    a: "One credit makes one ad image. Each run makes five ads in two sizes, so it uses 10 credits.",
  },
  {
    q: "Do I need to be a designer or marketer?",
    a: "Nope. Gooidy writes the hooks and copy and designs the ads. You pick your favorites.",
  },
  {
    q: "Where can I post the ads?",
    a: "Anywhere: TikTok, Instagram Reels and Stories, YouTube Shorts, Facebook. Download and go.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month to month, and you keep access until the end of the month you paid for.",
  },
];

// Light from 7:00 to 19:00 on the visitor's own clock, dark otherwise.
// Inline so it runs before the page paints; ?theme=light|dark forces one.
const THEME_BY_TIME = `(function(){try{var f=new URLSearchParams(location.search).get("theme");var h=new Date().getHours();document.documentElement.dataset.theme=f==="light"||f==="dark"?f:h>=7&&h<19?"light":"dark"}catch(e){}})()`;

export default function Home() {
  return (
    <div className="landing flex flex-1 flex-col overflow-x-clip bg-bg text-fg">
      <script dangerouslySetInnerHTML={{ __html: THEME_BY_TIME }} />
      <Nav />
      <main className="flex-1">
        <Hero />
        <ReelWall />
        <HookStrip />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="font-display glitch text-2xl font-extrabold tracking-tight">
      gooidy
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-fg/5 bg-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <div className="hidden items-center gap-7 text-sm font-medium text-fg/60 md:flex">
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#pricing" className="hover:text-fg">Pricing</a>
          <a href="#faq" className="hover:text-fg">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-fg/70 hover:text-fg">
            Log in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-fg px-4 py-2 text-sm font-bold text-bg transition hover:scale-105"
          >
            Sign up free
          </Link>
        </div>
      </nav>
    </header>
  );
}

function UrlForm({ id }: { id: string }) {
  // A plain GET form: signed-out visitors go through sign-in and land on the
  // dashboard with the link already filled in.
  return (
    <form
      action="/dashboard"
      method="get"
      className="neon-ring flex w-full max-w-xl flex-col gap-2 rounded-2xl bg-fg/[0.06] p-2 backdrop-blur sm:flex-row sm:rounded-full"
    >
      <label htmlFor={id} className="sr-only">
        Your product or store link
      </label>
      <input
        id={id}
        name="url"
        type="text"
        inputMode="url"
        placeholder="Paste your product link…"
        className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-3 text-fg outline-none placeholder:text-fg/40"
      />
      <button
        type="submit"
        className="rounded-full bg-[#fe2c55] px-6 py-3 font-bold text-white shadow-[0_0_30px_rgba(254,44,85,0.55)] transition hover:scale-[1.03] hover:bg-[#ff426a]"
      >
        Make it go viral →
      </button>
    </form>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div className="pointer-events-none absolute -left-40 top-10 h-[480px] w-[480px] rounded-full bg-[#25f4ee]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-40 h-[520px] w-[520px] rounded-full bg-[#fe2c55]/25 blur-[120px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="flex items-center gap-2 rounded-full border border-fg/10 bg-fg/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-fg/80">
            <span className="live-dot h-2 w-2 rounded-full bg-[#fe2c55]" />
            AI ads for TikTok · Reels · Shorts
          </span>
          <h1 className="font-display mt-6 text-[3.1rem] font-extrabold leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.4rem]">
            Make ads
            <br />
            people{" "}
            <span className="glitch-strong whitespace-nowrap">don&apos;t</span>
            <br />
            <span className="text-gradient">scroll past.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-fg/65">
            Paste a link. Gooidy writes the hooks, designs the ads and sizes
            them for every feed, in about two minutes. No designer, no agency,
            no cringe.
          </p>
          <div className="mt-8 flex w-full justify-center lg:justify-start">
            <UrlForm id="url-top" />
          </div>
          <p className="mt-3 text-sm text-fg/45">
            Free to start · 100 credits on us · No card needed
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <Phone />
        </div>
      </div>
    </section>
  );
}

// A phone that auto-scrolls through sample ads, like a For You feed.
function Phone() {
  const feed = [...REELS, REELS[0]];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[3.5rem] bg-gradient-to-br from-[#25f4ee]/40 via-transparent to-[#fe2c55]/50 blur-2xl" />
      <div className="relative h-[560px] w-[280px] rounded-[3rem] border border-fg/15 bg-black p-2.5 shadow-2xl sm:h-[620px] sm:w-[310px]">
        <div className="relative h-full w-full overflow-hidden rounded-[2.4rem]">
          <div className="feed-scroll h-[500%]">
            {feed.map((reel, i) => (
              <div key={i} className="h-[20%]">
                <Reel reel={reel} live />
              </div>
            ))}
          </div>
          {/* App chrome over the feed */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-4 pt-9 text-sm font-semibold text-white/70">
            <span>Following</span>
            <span className="border-b-2 border-white pb-0.5 text-white">For You</span>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-2.5 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        </div>
      </div>

      {/* Floating stickers */}
      <div className="sticker absolute -left-10 top-24 rounded-2xl bg-white px-3 py-2 text-black shadow-xl sm:-left-16">
        <p className="text-[10px] font-semibold uppercase text-black/50">Views</p>
        <p className="font-display text-xl font-extrabold">
          <Ticker start={2_480_000} step={900} every={250} />
        </p>
      </div>
      <div className="sticker-delay absolute -right-6 bottom-6 rounded-2xl bg-[#25f4ee] px-3 py-2 font-bold text-black shadow-xl sm:-right-12">
        🔥 Ready in 2 min
      </div>
      <p className="mt-4 text-center text-[11px] text-fg/35">Sample ads for illustration</p>
    </div>
  );
}

function ReelRow({ reels, reverse = false }: { reels: SampleReel[]; reverse?: boolean }) {
  const items = [...reels, ...reels, ...reels, ...reels];
  return (
    <div className="flex overflow-hidden">
      <div className={`flex shrink-0 gap-4 pr-4 ${reverse ? "marquee-reverse" : "marquee"}`}>
        {items.map((reel, i) => (
          <div
            key={i}
            className="h-[300px] w-[170px] shrink-0 overflow-hidden rounded-2xl ring-1 ring-fg/10 sm:h-[340px] sm:w-[192px]"
          >
            <Reel reel={reel} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReelWall() {
  return (
    <section className="relative py-12">
      <h2 className="font-display mx-auto max-w-3xl px-4 text-center text-4xl font-extrabold tracking-tight sm:text-6xl">
        One link. <span className="text-gradient">Endless ads.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl px-4 text-center text-lg text-fg/60">
        Fresh hooks, fresh angles, every run. Test more, guess less, and let
        the feed pick your winner.
      </p>
      <div className="mt-12 flex -rotate-2 flex-col gap-4">
        <ReelRow reels={REELS} />
        <ReelRow reels={[...REELS].reverse()} reverse />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg sm:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg sm:w-40" />
    </section>
  );
}

function HookStrip() {
  const items = [...HOOKS, ...HOOKS];
  return (
    <section className="border-y border-fg/10 bg-[#fe2c55] py-4 text-black">
      <div className="flex overflow-hidden">
        <div className="marquee-fast flex shrink-0 items-center gap-8 pr-8">
          {items.map((hook, i) => (
            <span key={i} className="font-display flex items-center gap-8 whitespace-nowrap text-2xl font-extrabold">
              {hook}
              <span className="text-white">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{kicker}</p>
      <h2 className="font-display mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">{title}</h2>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
      <SectionHeading
        kicker="How it works"
        title={
          <>
            Link in. <span className="text-gradient">Ads out.</span>
          </>
        }
      />
      <ol className="mt-14 grid gap-5 md:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="relative overflow-hidden rounded-3xl border border-fg/10 bg-fg/[0.04] p-7 transition hover:-translate-y-1 hover:border-fg/25"
          >
            <span className="font-display text-gradient text-6xl font-extrabold">{step.n}</span>
            <h3 className="font-display mt-4 text-2xl font-extrabold">{step.title}</h3>
            <p className="mt-2 text-fg/60">{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {[
          ["🎯", "Knows your brand", "Builds a brief from your site: tone, audience, selling points."],
          ["📐", "Every format", "9:16 for TikTok, Reels and Shorts. 1:1 for the feed."],
          ["🎨", "Your look", "Your logo, colors and font on every single ad."],
        ].map(([icon, title, body]) => (
          <div key={title} className="flex gap-4 rounded-2xl border border-fg/10 p-5">
            <span className="text-2xl">{icon}</span>
            <div>
              <p className="font-bold">{title}</p>
              <p className="mt-1 text-sm text-fg/55">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
      <SectionHeading
        kicker="Pricing"
        title={
          <>
            Cheaper than <span className="text-gradient">one agency ad.</span>
          </>
        }
      />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-3xl p-8 ${
              plan.featured
                ? "neon-ring bg-gradient-to-b from-fg/[0.12] to-fg/[0.03]"
                : "border border-fg/10 bg-fg/[0.03]"
            }`}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-8 rounded-full bg-[#fe2c55] px-3 py-1 text-xs font-bold">
                🔥 Most popular
              </span>
            )}
            <h3 className="font-display text-xl font-extrabold">{plan.name}</h3>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-6xl font-extrabold">{plan.price}</span>
              <span className="text-fg/50">{plan.note}</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-accent">{plan.credits}</p>
            <ul className="mt-6 flex-1 space-y-3 text-fg/80">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span className="text-[#fe2c55]">✓</span>
                  {perk}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className={`mt-8 rounded-full px-5 py-3 text-center font-bold transition hover:scale-[1.03] ${
                plan.featured ? "bg-[#fe2c55] text-white" : "bg-fg text-bg"
              }`}
            >
              Start free
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-24">
      <SectionHeading kicker="FAQ" title="Quick answers" />
      <div className="mt-12 divide-y divide-fg/10 rounded-3xl border border-fg/10 bg-fg/[0.03] px-6">
        {FAQ.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
              {item.q}
              <span className="text-2xl text-accent transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-fg/60">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border border-fg/10 bg-surface px-6 py-20 text-center sm:px-16">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#25f4ee]/30 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#fe2c55]/40 blur-[90px]" />
        <h2 className="font-display relative text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
          Your next <span className="glitch-strong">viral</span> ad
          <br />
          is one link away.
        </h2>
        <div className="relative mt-10 flex justify-center">
          <UrlForm id="url-bottom" />
        </div>
        <p className="relative mt-3 text-sm text-fg/45">Free · 100 credits · No card needed</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-fg/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-fg/45 sm:flex-row">
        <Logo />
        <p>© 2026 Gooidy. Made for the feed.</p>
        <div className="flex gap-5">
          <a href="#pricing" className="hover:text-fg">Pricing</a>
          <Link href="/login" className="hover:text-fg">Log in</Link>
        </div>
      </div>
    </footer>
  );
}
