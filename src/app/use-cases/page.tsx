import Link from "next/link";
import { REELS, Reel, type SampleReel } from "../_landing/reel";
import {
  THEME_BY_TIME,
  Nav,
  UrlForm,
  SectionHeading,
  Footer,
} from "../_landing/chrome";
import { Reveal } from "../_landing/reveal";

export const metadata = {
  title: "Use cases · Gooidy",
  description:
    "See what Gooidy makes for fashion, beauty, pets, food, home, fitness and local businesses. Paste a link and get ads for every goal. Start free.",
};

type Industry = {
  id: string;
  name: string;
  pitch: string;
  ideas: string[];
  reel: SampleReel;
};

const byHandle = (handle: string) => REELS.find((r) => r.handle === handle)!;

const INDUSTRIES: Industry[] = [
  {
    id: "fashion",
    name: "Fashion & apparel",
    pitch:
      "Show fit, fabric and feel. Gooidy writes the hooks that make people stop on a cardigan.",
    ideas: ["New drop", "How to style it", "Fabric close-up", "Size & fit"],
    reel: byHandle("softmila"),
  },
  {
    id: "beauty",
    name: "Beauty & skincare",
    pitch:
      "Routines, results and ingredients, explained in one line someone actually reads.",
    ideas: ["Routine steps", "Ingredient focus", "Before you buy", "Gift set"],
    reel: byHandle("glowlab"),
  },
  {
    id: "pets",
    name: "Pet products",
    pitch:
      "Lead with the problem every owner knows, then show the fix in the first second.",
    ideas: ["Problem → fix", "Happy pet", "Vet approved", "Bundle offer"],
    reel: byHandle("pawsclub"),
  },
  {
    id: "food",
    name: "Food & drink",
    pitch:
      "Make it look fresh and make it feel easy to order. Great for subscriptions and gifting.",
    ideas: ["Freshness", "Subscribe & save", "Gift it", "Seasonal flavour"],
    reel: byHandle("beanandbloom"),
  },
  {
    id: "home",
    name: "Home & decor",
    pitch:
      "Put the product in a room people want to live in, and let the space do the selling.",
    ideas: ["Room makeover", "Small space", "Materials", "Holiday table"],
    reel: {
      handle: "oakandlinen",
      hook: "The lamp that changes the room",
      caption: "Warm light, hand-finished oak",
      cta: "Shop the look",
      likes: 22_300,
      comments: 371,
      from: "#efe6da",
      to: "#8a7158",
      blob: "linear-gradient(135deg,#fff4dc,#d9b98c)",
    },
  },
  {
    id: "fitness",
    name: "Fitness & wellness",
    pitch:
      "Motivation that converts: small promises, clear routines and real-life results.",
    ideas: [
      "7-day challenge",
      "Home workout",
      "Gear spotlight",
      "First class free",
    ],
    reel: {
      handle: "corestudio",
      hook: "20 minutes. No gym.",
      caption: "Your first week, planned for you",
      cta: "Start free",
      likes: 35_800,
      comments: 702,
      from: "#d9e4ff",
      to: "#3949ab",
      blob: "linear-gradient(135deg,#ffffff,#9fa8da)",
    },
  },
  {
    id: "local",
    name: "Restaurants & local shops",
    pitch:
      "Bring people through the door this week with offers sized for your neighbourhood.",
    ideas: ["Today's special", "Happy hour", "New menu", "Book a table"],
    reel: {
      handle: "lunatrattoria",
      hook: "Fresh pasta, made at 9am",
      caption: "Walk-ins welcome until 10pm",
      cta: "Book a table",
      likes: 12_900,
      comments: 233,
      from: "#ffe0cc",
      to: "#b5432f",
      blob: "linear-gradient(135deg,#fff3c4,#f2a65a)",
    },
  },
  {
    id: "services",
    name: "Services & studios",
    pitch:
      "Salons, coaches, cleaners and clinics: turn a booking page into ads that fill the calendar.",
    ideas: ["Book now", "Before & after", "Meet the team", "New client offer"],
    reel: {
      handle: "studiosol",
      hook: "Your hair, but easier",
      caption: "New clients get 20% off this month",
      cta: "Book now",
      likes: 9_400,
      comments: 187,
      from: "#f3dcf0",
      to: "#7b3f78",
      blob: "linear-gradient(135deg,#ffffff,#e3b6dd)",
    },
  },
];

const GOALS = [
  {
    name: "Launch a new product",
    example: "Meet the cardigan you'll live in.",
    body: "Announce it with five angles at once and see which one people tap.",
  },
  {
    name: "Run a sale or promo",
    example: "Free shipping, this week only.",
    body: "Offer-led ads with a clear deadline, ready for Black Friday and every holiday after.",
  },
  {
    name: "Bring back past visitors",
    example: "Still thinking about it?",
    body: "Gentle reminder ads for people who looked but didn't buy.",
  },
  {
    name: "Back in stock",
    example: "It sold out. It's back.",
    body: "Turn a restock into urgency, without sounding pushy.",
  },
  {
    name: "Grow your social",
    example: "Three ways to wear one wrap.",
    body: "Posts that look native in the feed, so they earn follows as well as clicks.",
  },
  {
    name: "Test what works",
    example: "Same product, five different hooks.",
    body: "Every run gives you several angles side by side, so you learn what sells.",
  },
];

const FORMATS = [
  {
    name: "Feed posts",
    size: "1:1 square",
    where: "Instagram and Facebook feeds",
    ready: true,
  },
  {
    name: "Stories & Reels",
    size: "9:16 vertical",
    where: "Instagram, Facebook and TikTok",
    ready: true,
  },
  {
    name: "Ad copy",
    size: "Headline, text, call to action",
    where: "Written for each angle",
    ready: true,
  },
  {
    name: "Video ads",
    size: "Short vertical clips",
    where: "Reels, Shorts and TikTok",
    ready: false,
  },
];

const FIT = [
  {
    tool: "AI video studios",
    good: "Great for filmmakers and creative teams.",
    catch: "You prompt and edit every shot yourself.",
  },
  {
    tool: "All-in-one marketing agents",
    good: "Cover websites, email, mail and ads.",
    catch: "A lot to set up when you only want ads.",
  },
  {
    tool: "Gooidy",
    good: "Built for small shops: one link in, ads out.",
    catch: "Copy, design and sizes done for you, starting free.",
    ours: true,
  },
];

export default function UseCases() {
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <script dangerouslySetInnerHTML={{ __html: THEME_BY_TIME }} />
      <Nav />
      <main className="flex-1">
        <Hero />
        <Industries />
        <Goals />
        <Formats />
        <Fit />
        <FinalCta />
      </main>
      <Footer />
      <Reveal />
    </div>
  );
}

function Hero() {
  return (
    <section className="hero-bg">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-14 text-center sm:pt-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-sm text-muted shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Use cases
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Whatever you sell, <span className="text-accent">advertise it</span>{" "}
          today.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Shops, cafés, studios and brands use one link to get ads for every
          goal. Here is what Gooidy makes for businesses like yours.
        </p>
        <div
          className="-mx-4 mt-8 flex max-w-full gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
          aria-label="Jump to a business type"
        >
          {INDUSTRIES.map((i) => (
            <a
              key={i.id}
              href={`#${i.id}`}
              className="shrink-0 whitespace-nowrap rounded-full border border-line bg-bg px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-fg"
            >
              {i.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Industries() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <SectionHeading
        title="Made for your kind of business"
        sub="Sample ads by industry. Paste your own link to get ones made from your products."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {INDUSTRIES.map((ind) => (
          <article
            key={ind.id}
            id={ind.id}
            className="reveal flex scroll-mt-24 gap-5 rounded-2xl border border-line bg-bg p-4 transition-shadow hover:shadow-lg sm:p-5"
          >
            <div className="aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl sm:w-36">
              <Reel reel={ind.reel} rail={false} />
            </div>
            <div className="flex min-w-0 flex-col">
              <h3 className="text-lg font-medium">{ind.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {ind.pitch}
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {ind.ideas.map((idea) => (
                  <li
                    key={idea}
                    className="rounded-md bg-surface px-2 py-1 text-xs text-muted"
                  >
                    {idea}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="mt-auto pt-4 text-sm font-medium text-accent hover:underline"
              >
                Try it with your link →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Goals() {
  return (
    <section className="reveal border-y border-line bg-surface px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Ads for every goal"
          sub="Tell Gooidy what you want this week. It picks the angle and writes the hook."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GOALS.map((g) => (
            <div
              key={g.name}
              className="rounded-2xl border border-line bg-bg p-6"
            >
              <h3 className="font-medium">{g.name}</h3>
              <p className="mt-3 border-l-2 border-accent pl-3 text-lg font-medium leading-snug">
                “{g.example}”
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {g.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Formats() {
  return (
    <section className="reveal mx-auto max-w-6xl px-4 py-20">
      <SectionHeading
        title="Every size, from one run"
        sub="No resizing, no designer. Each ad comes ready for where it will run."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATS.map((f) => (
          <div key={f.name} className="rounded-2xl border border-line p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{f.name}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  f.ready ? "bg-accent/10 text-accent" : "bg-surface text-muted"
                }`}
              >
                {f.ready ? "Ready" : "Coming soon"}
              </span>
            </div>
            <p className="mt-3 text-sm">{f.size}</p>
            <p className="mt-1 text-sm text-muted">{f.where}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Fit() {
  return (
    <section className="reveal mx-auto max-w-6xl px-4 pb-20">
      <SectionHeading
        title="Where Gooidy fits"
        sub="There are lots of AI tools. Gooidy is the one made for small businesses that just need ads."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {FIT.map((f) => (
          <div
            key={f.tool}
            className={`rounded-2xl border p-6 ${
              f.ours
                ? "border-accent bg-accent/[0.06] shadow-sm"
                : "border-line"
            }`}
          >
            <h3 className={`font-medium ${f.ours ? "text-accent" : ""}`}>
              {f.tool}
            </h3>
            <p className="mt-3 text-sm leading-relaxed">{f.good}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{f.catch}</p>
          </div>
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
          See it with your own products
        </h2>
        <p className="mt-3 text-lg text-muted">
          Paste a link and get your first ads in about two minutes. 100 free
          credits, no credit card.
        </p>
        <div className="mt-8 flex w-full justify-center">
          <UrlForm id="url-use-cases" />
        </div>
      </div>
    </section>
  );
}
