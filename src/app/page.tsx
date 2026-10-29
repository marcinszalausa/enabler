import Link from "next/link";
import { AdMockup, SAMPLE_ADS } from "./_landing/ad-mockup";

export const metadata = {
  title: "Gooidy · Paste a link, get ads that sell",
  description:
    "Gooidy turns your product page into scroll-stopping ads for Facebook, Instagram and TikTok in minutes. Start free.",
};

const STEPS = [
  {
    title: "Paste your link",
    body: "Drop in a product page or your website. Gooidy reads it like a marketer would: what you sell, who it's for and why they'll love it.",
  },
  {
    title: "Get a batch of ads",
    body: "Five fresh angles, each with a headline, copy and an image in square and story sizes, on brand with your logo, colors and font.",
  },
  {
    title: "Pick, tweak, launch",
    body: "Keep the winners, download them, and run them on Facebook, Instagram and TikTok. One-click publishing to Meta is on the way.",
  },
];

const FEATURES = [
  {
    title: "Knows your brand",
    body: "Builds a brand brief from your site: tone, audience, selling points. No forms to fill in.",
    icon: "✦",
  },
  {
    title: "Angles that convert",
    body: "Problem and solution, social proof, offer, lifestyle and more. Test what works instead of guessing.",
    icon: "◎",
  },
  {
    title: "Every size you need",
    body: "Square for the feed, vertical for Stories and Reels. Made at the same time, from the same idea.",
    icon: "▣",
  },
  {
    title: "Your brand kit",
    body: "Upload your logo, set your button color and font once. Every ad follows it, even old ones.",
    icon: "◐",
  },
  {
    title: "Video ads",
    body: "Short product videos built from your photos.",
    icon: "▶",
    soon: true,
  },
  {
    title: "Publish and learn",
    body: "Launch to Meta from Gooidy, then let results shape your next batch.",
    icon: "↗",
    soon: true,
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "to try it out",
    credits: "100 credits, once",
    perks: ["About 50 ads in two sizes", "Brand kit", "Download every ad"],
    cta: "Start free",
  },
  {
    name: "Starter",
    price: "$29",
    note: "per month",
    credits: "300 credits every month",
    perks: ["About 150 ads a month", "Everything in Free", "Cancel anytime"],
    cta: "Start free",
    featured: true,
  },
  {
    name: "Growth",
    price: "$79",
    note: "per month",
    credits: "1,000 credits every month",
    perks: ["About 500 ads a month", "Everything in Starter", "Priority support"],
    cta: "Start free",
  },
];

const FAQ = [
  {
    q: "What do I need to get started?",
    a: "Just a link to your product or website. Gooidy works with Shopify, WooCommerce, Wix, Squarespace and most online stores.",
  },
  {
    q: "What is a credit?",
    a: "One credit makes one ad image. Each run creates five ads in two sizes, so it uses 10 credits.",
  },
  {
    q: "Do I need design or marketing experience?",
    a: "No. Gooidy writes the copy and designs the ads for you. You choose the ones you like and can edit the text.",
  },
  {
    q: "Can I use the ads anywhere?",
    a: "Yes. Download them and run them on Facebook, Instagram, TikTok or anywhere else you advertise.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Paid plans are month to month, and you keep access until the end of the month you paid for.",
  },
];

export default function Home() {
  return (
    <div className="landing flex flex-1 flex-col bg-[#fffaf5] text-[#17122b]">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Platforms />
        <HowItWorks />
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
    <Link href="/" className="font-display flex items-center gap-1.5 text-2xl font-bold tracking-tight">
      <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-br from-violet-600 via-pink-500 to-orange-400" />
      gooidy
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-black/5 bg-[#fffaf5]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <div className="hidden items-center gap-7 text-sm font-medium text-[#17122b]/70 md:flex">
          <a href="#how" className="hover:text-[#17122b]">How it works</a>
          <a href="#features" className="hover:text-[#17122b]">Features</a>
          <a href="#pricing" className="hover:text-[#17122b]">Pricing</a>
          <a href="#faq" className="hover:text-[#17122b]">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-[#17122b]/80 hover:text-[#17122b]">
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-[#17122b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}

function UrlForm({ dark = false }: { dark?: boolean }) {
  // A plain GET form: signed-out visitors go through sign-in and land on the
  // dashboard with the link already filled in.
  return (
    <form
      action="/dashboard"
      method="get"
      className={`flex w-full max-w-xl flex-col gap-2 rounded-2xl p-2 sm:flex-row sm:rounded-full ${
        dark ? "bg-white/10 ring-1 ring-white/20" : "bg-white shadow-xl shadow-violet-900/10 ring-1 ring-black/5"
      }`}
    >
      <label htmlFor={dark ? "url-bottom" : "url-top"} className="sr-only">
        Your product or website link
      </label>
      <input
        id={dark ? "url-bottom" : "url-top"}
        name="url"
        type="text"
        inputMode="url"
        placeholder="yourstore.com/products/..."
        className={`min-w-0 flex-1 rounded-full bg-transparent px-4 py-3 outline-none ${
          dark ? "text-white placeholder:text-white/60" : "placeholder:text-[#17122b]/40"
        }`}
      />
      <button
        type="submit"
        className="rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-orange-400 px-6 py-3 font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110"
      >
        Make my ads
      </button>
    </form>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-300/50 via-pink-300/40 to-orange-200/50 blur-3xl" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-10 pt-16 text-center sm:pt-24">
        <span className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-medium text-violet-700 ring-1 ring-violet-200">
          ✦ The AI ad maker for small businesses
        </span>
        <h1 className="font-display mt-6 max-w-4xl text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-5xl md:text-7xl">
          Paste a link.
          <br />
          <span className="bg-gradient-to-r from-violet-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
            Get ads that sell.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-[#17122b]/70 sm:text-xl">
          Gooidy turns your product page into scroll-stopping ads for Facebook,
          Instagram and TikTok. Copy, images and every size you need, in about
          two minutes. No designer, no agency.
        </p>
        <div className="mt-9 flex w-full justify-center">
          <UrlForm />
        </div>
        <p className="mt-3 text-sm text-[#17122b]/55">
          Free to start · 100 credits on us · No card needed
        </p>

        <div className="mt-16 grid w-full max-w-5xl grid-cols-2 items-end gap-4 sm:grid-cols-4 sm:gap-6">
          {SAMPLE_ADS.map((ad, i) => (
            <AdMockup
              key={ad.brand}
              ad={ad}
              className={i % 2 === 0 ? "sm:-rotate-2" : "sm:translate-y-6 sm:rotate-2"}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Platforms() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-6 pt-16">
      <p className="text-center text-sm font-medium uppercase tracking-widest text-[#17122b]/45">
        Ready for
      </p>
      <div className="font-display mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xl font-semibold text-[#17122b]/60 sm:text-2xl">
        <span>Facebook</span>
        <span>Instagram</span>
        <span>TikTok</span>
        <span>Reels</span>
        <span>Stories</span>
      </div>
    </section>
  );
}

function SectionHeading({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-pink-600">{kicker}</p>
      <h2 className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-[#17122b]/65">{sub}</p>}
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
      <SectionHeading
        kicker="How it works"
        title="From link to launch in three steps"
        sub="What used to take an agency a week now takes a coffee break."
      />
      <ol className="mt-14 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5">
            <span className="font-display flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-pink-500 to-orange-400 text-lg font-bold text-white">
              {i + 1}
            </span>
            <h3 className="font-display mt-5 text-xl font-bold">{step.title}</h3>
            <p className="mt-2 text-[#17122b]/65">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-20 bg-[#17122b] py-24 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-300">Features</p>
          <h2 className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Your in-house ad team, minus the payroll
          </h2>
          <p className="mt-4 text-lg text-white/65">
            Built for shop owners who&apos;d rather run their business than
            fight with design tools.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl bg-white/[0.06] p-7 ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg text-orange-300">
                  {f.icon}
                </span>
                {f.soon && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                    Coming soon
                  </span>
                )}
              </div>
              <h3 className="font-display mt-5 text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-white/65">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
      <SectionHeading
        kicker="Pricing"
        title="Simple plans that grow with you"
        sub="Start free. Upgrade when your ads start paying for themselves."
      />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-3xl p-8 ${
              plan.featured
                ? "bg-[#17122b] text-white shadow-2xl shadow-violet-900/30"
                : "bg-white ring-1 ring-black/5"
            }`}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-8 rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-orange-400 px-3 py-1 text-xs font-bold text-white">
                Most popular
              </span>
            )}
            <h3 className="font-display text-xl font-bold">{plan.name}</h3>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold">{plan.price}</span>
              <span className={plan.featured ? "text-white/60" : "text-[#17122b]/55"}>{plan.note}</span>
            </p>
            <p className={`mt-2 text-sm font-medium ${plan.featured ? "text-orange-300" : "text-violet-700"}`}>
              {plan.credits}
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span className={plan.featured ? "text-orange-300" : "text-pink-600"}>✓</span>
                  {perk}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className={`mt-8 rounded-full px-5 py-3 text-center font-semibold transition ${
                plan.featured
                  ? "bg-white text-[#17122b] hover:bg-orange-100"
                  : "bg-[#17122b] text-white hover:bg-violet-700"
              }`}
            >
              {plan.cta}
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
      <SectionHeading kicker="FAQ" title="Questions, answered" />
      <div className="mt-12 divide-y divide-black/10 rounded-3xl bg-white px-6 ring-1 ring-black/5">
        {FAQ.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {item.q}
              <span className="text-xl text-pink-600 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-[#17122b]/65">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-700 via-pink-600 to-orange-500 px-6 py-16 text-center text-white sm:px-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <h2 className="font-display relative text-4xl font-bold tracking-tight sm:text-5xl">
          Your next best ad is one link away
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/80">
          Try Gooidy free. See your first ads before your coffee gets cold.
        </p>
        <div className="relative mt-8 flex justify-center">
          <UrlForm dark />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-black/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-[#17122b]/55 sm:flex-row">
        <Logo />
        <p>© 2026 Gooidy. Ads made simple.</p>
        <div className="flex gap-5">
          <a href="#pricing" className="hover:text-[#17122b]">Pricing</a>
          <Link href="/login" className="hover:text-[#17122b]">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
