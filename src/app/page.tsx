import Link from "next/link";
import { REELS, Reel } from "./_landing/reel";
import { ThemeToggle } from "./_landing/theme-toggle";

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
const THEME_BY_TIME = `(function(){var d=document.documentElement,t;try{t=new URLSearchParams(location.search).get("theme");if(t!=="light"&&t!=="dark")t=localStorage.getItem("gooidy-theme")}catch(e){}if(t!=="light"&&t!=="dark"){var h=new Date().getHours();t=h>=7&&h<19?"light":"dark"}d.dataset.theme=t})()`;

export default function Home() {
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <script dangerouslySetInnerHTML={{ __html: THEME_BY_TIME }} />
      <Nav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Examples />
        <Features />
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
    <Link
      href="/"
      className="flex items-center gap-2 text-xl font-semibold tracking-tight"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
      gooidy
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how" className="hover:text-fg">
            How it works
          </a>
          <a href="#pricing" className="hover:text-fg">
            Pricing
          </a>
          <a href="#faq" className="hover:text-fg">
            FAQ
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-accent hover:bg-surface"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="hidden rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:shadow-md sm:block dark-accent-text"
          >
            Get started
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
      className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
    >
      <label htmlFor={id} className="sr-only">
        Your product or store link
      </label>
      <input
        id={id}
        name="url"
        type="text"
        inputMode="url"
        placeholder="Paste your product or store link"
        className="min-w-0 flex-1 rounded-full border border-line bg-bg px-5 py-3 text-fg outline-none transition-shadow placeholder:text-muted hover:shadow-md focus:border-accent focus:shadow-md"
      />
      <button
        type="submit"
        className="dark-accent-text rounded-full bg-accent px-6 py-3 font-medium text-white transition-shadow hover:shadow-md"
      >
        Create ads
      </button>
    </form>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="text-center lg:text-left">
        <p className="text-sm font-medium text-accent">
          AI ads for small businesses
        </p>
        <h1 className="mt-4 text-4xl font-medium leading-tight tracking-tight sm:text-6xl">
          Ads that sell, from a single link.
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
        <Phone />
      </div>
    </section>
  );
}

// A phone that steps through the sample ads, like a short-video feed.
function Phone() {
  const feed = [...REELS, REELS[0]];
  return (
    <div className="h-[540px] w-[270px] rounded-[2.5rem] border border-line bg-[#202124] p-2 shadow-xl sm:h-[600px] sm:w-[300px]">
      <div className="relative h-full w-full overflow-hidden rounded-[2rem]">
        <div className="feed-scroll h-[500%]">
          {feed.map((reel, i) => (
            <div key={i} className="h-[20%]">
              <Reel reel={reel} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
        {title}
      </h2>
      {sub && <p className="mt-3 text-lg text-muted">{sub}</p>}
    </div>
  );
}

function HowItWorks() {
  return (
    <section
      id="how"
      className="scroll-mt-16 border-t border-line bg-surface py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
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

function Examples() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <SectionHeading
        title="Made for the feed"
        sub="Sample ads in the vertical format people watch most."
      />
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {REELS.map((reel) => (
          <div
            key={reel.handle}
            className="aspect-[9/16] overflow-hidden rounded-2xl border border-line"
          >
            <Reel reel={reel} rail={false} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
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
    <section
      id="pricing"
      className="scroll-mt-16 border-t border-line bg-surface py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
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
                className={`mt-8 rounded-full px-5 py-2.5 text-center text-sm font-medium transition-shadow hover:shadow-md ${
                  plan.featured
                    ? "dark-accent-text bg-accent text-white"
                    : "border border-line text-accent"
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
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-20">
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

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row">
        <Logo />
        <p>© 2026 Gooidy</p>
        <div className="flex gap-6">
          <a href="#pricing" className="hover:text-fg">
            Pricing
          </a>
          <Link href="/login" className="hover:text-fg">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
