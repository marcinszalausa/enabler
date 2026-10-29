import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FALLBACK_AD, type FeedAd } from "@/app/_landing/reel";
import { PhoneFeed } from "@/app/_landing/phone-feed";
import { getShowcase, type ShowcaseRun } from "@/lib/showcase";
import { LANGUAGES } from "@/lib/video-options";
import { VIDEO_SECONDS } from "@/lib/video";
import { Nav, UrlForm, SectionHeading, Footer } from "@/app/_landing/chrome";
import { AngleExplorer, type AngleAd } from "@/app/_landing/angle-explorer";
import { HeroStage } from "@/app/_landing/hero-stage";
import { RunDemo, type DemoRun } from "@/app/_landing/run-demo";
import { Reveal } from "@/app/_landing/reveal";
import { Placements, type PlacementAd } from "@/app/_landing/placements";
import { StickyCta } from "@/app/_landing/sticky-cta";
import { Spotlight } from "@/app/_landing/spotlight";
import { BeforeAfter } from "@/app/_landing/before-after";
import { alternates, isLocale, localePath, type Locale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { PLAN_PRICES, usd } from "@/lib/pricing";
import { LocalPrice } from "@/app/_landing/local-price";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getMessages(locale);
  return {
    title: t.meta.title,
    description: t.meta.description,
    alternates: alternates(locale, "/"),
  };
}

// Prices stay in dollars in every language (buyers pay in their own currency
// at checkout); the names and perks are in the messages.
const PRICES = Object.values(PLAN_PRICES);
const FEATURED = 1;

// Placeholders shared by several strings.
const COUNTS = { count: Object.keys(LANGUAGES).length, seconds: VIDEO_SECONDS };

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  const { runs, images, videos } = await showcaseAds(t);
  const feed = heroFeed(images, videos);
  // Side phones show other ads than the one the middle phone opens on.
  const sides = images.length > 2 ? images.slice(-2) : [];
  const run = runs[0];
  const pictured = runs.find((r) => r.productImage);
  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <Nav />
      <main className="flex-1">
        <Hero t={t} feed={feed} left={sides[0]} right={sides[1]} />
        <WorksWith t={t} />
        {pictured && <FromPhoto run={pictured} />}
        {run ? <HowItWorksLive t={t} run={run} /> : <HowItWorks t={t} />}
        {videos.length > 0 && <VideoAds t={t} ads={videos} />}
        {run && <Angles t={t} run={run} />}
        {run && <WhereItRuns t={t} run={run} />}
        {runs.length > 0 && <Examples t={t} locale={locale} runs={runs} />}
        <Features t={t} run={run} />
        <Pricing t={t} locale={locale} />
        <Faq t={t} />
        <FinalCta t={t} />
      </main>
      <Footer />
      <StickyCta />
      <Spotlight />
      <Reveal />
    </div>
  );
}

// Real 9:16 ads from the showcase, one per product first, then more angles.
async function showcaseAds(t: Messages) {
  const [imageRuns, videoRuns] = await Promise.all([
    getShowcase(),
    getShowcase("video_ads"),
  ]);
  return {
    runs: imageRuns,
    images: roundRobin(imageRuns, (r, a) => ({
      ...about(r, a),
      image: image(a.id),
    })),
    videos: roundRobin(videoRuns, (r, a) => ({
      ...about(r, a),
      video: { src: `/api/creatives/${a.id}/video` },
      format: fmt(t.home.videoFormat, COUNTS),
      sound: true,
    })),
  };
}

type Ad = ShowcaseRun["ads"][number];

function about(r: ShowcaseRun, a: Ad): FeedAd {
  return {
    alt: a.headline,
    angle: a.angle,
    store: r.store,
    madeIn: r.seconds ? duration(r.seconds) : undefined,
  };
}

function roundRobin(
  runs: ShowcaseRun[],
  toAd: (r: ShowcaseRun, a: Ad) => FeedAd,
): FeedAd[] {
  const stories = runs.map((r) =>
    r.ads.filter((a) => a.aspect === "9:16").map((a) => toAd(r, a)),
  );
  const ads: FeedAd[] = [];
  for (let round = 0; stories.some((s) => s[round]); round++)
    for (const s of stories) if (s[round]) ads.push(s[round]);
  return ads;
}

// The hero phone opens on a video ad when there is one, then alternates.
// Falls back to the Soft Mila clip before any run is picked.
function heroFeed(images: FeedAd[], videos: FeedAd[]): FeedAd[] {
  const feed: FeedAd[] = [];
  for (let i = 0; feed.length < 6 && (videos[i] || images[i]); i++) {
    if (videos[i]) feed.push(videos[i]);
    if (images[i] && feed.length < 6) feed.push(images[i]);
  }
  return feed.length ? feed : [FALLBACK_AD];
}

const image = (id: string) => `/api/creatives/${id}/image`;

function duration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function Hero({
  t,
  feed,
  left,
  right,
}: {
  t: Messages;
  feed: FeedAd[];
  left?: FeedAd;
  right?: FeedAd;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="grid-fade" aria-hidden />
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-14 text-center sm:pt-20">
        <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          {t.home.badge}
        </p>
        <h1 className="mt-6 max-w-4xl text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-7xl lg:text-[5.25rem]">
          {t.home.titleLine1}
          <br />
          {t.home.titleBefore}
          <span className="text-shimmer">{t.home.titleWord}</span>
          {t.home.titleAfter}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
          {t.home.intro}
        </p>
        <div className="mt-9 flex w-full justify-center">
          <UrlForm id="url-top" />
        </div>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
          {t.home.facts.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-accent">✓</span>
              {fmt(f, COUNTS)}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto mt-16 max-w-6xl px-4 pb-24">
        <HeroStage feed={feed} left={left} right={right} />
      </div>
    </section>
  );
}

function WorksWith({ t }: { t: Messages }) {
  return (
    <section className="border-y border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted">{t.home.worksWith}</p>
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

function Angles({ t, run }: { t: Messages; run: ShowcaseRun }) {
  const ads: AngleAd[] = run.ads
    .filter((a) => a.aspect === "1:1")
    .map((a) => ({ ...a, image: image(a.id) }));
  if (ads.length === 0) return null;
  return (
    <section
      id="angles"
      className="reveal mx-auto max-w-6xl scroll-mt-16 px-4 py-24"
    >
      <SectionHeading
        title={t.home.anglesTitle}
        sub={fmt(t.home.anglesSub, { store: run.store })}
      />
      <div className="mt-14">
        <AngleExplorer store={run.store} ads={ads} />
      </div>
    </section>
  );
}

// The store's own product photo next to the ads Gooidy made from it.
function FromPhoto({ run }: { run: ShowcaseRun }) {
  const ads = run.ads
    .filter((a) => a.aspect === "9:16")
    .slice(0, 3)
    .map((a) => ({ image: image(a.id), alt: a.headline }));
  if (!run.productImage || ads.length === 0) return null;
  return (
    <BeforeAfter
      photo={run.productImage}
      name={run.productName}
      url={run.productUrl}
      madeIn={run.seconds ? duration(run.seconds) : undefined}
      ads={ads}
    />
  );
}

// One real ad from the run, shown inside each app it runs in.
function WhereItRuns({ t, run }: { t: Messages; run: ShowcaseRun }) {
  const story = run.ads.find((a) => a.aspect === "9:16");
  const square = run.ads.find((a) => a.aspect === "1:1");
  if (!story || !square) return null;
  const ad: PlacementAd = {
    story: { image: image(story.id), alt: story.headline },
    square: {
      image: image(square.id),
      alt: square.headline,
      primaryText: square.primaryText,
    },
    store: run.store,
  };
  return (
    <section className="reveal mx-auto max-w-6xl px-4 pb-24">
      <SectionHeading title={t.home.whereTitle} sub={t.home.whereSub} />
      <div className="mt-14">
        <Placements ad={ad} />
      </div>
    </section>
  );
}

function HowItWorksLive({ t, run }: { t: Messages; run: ShowcaseRun }) {
  const demo: DemoRun = {
    url: run.productUrl,
    store: run.store,
    summary: run.summary,
    audience: run.audience,
    madeIn: run.seconds ? duration(run.seconds) : undefined,
    ads: run.ads
      .filter((a) => a.aspect === "9:16")
      .map((a) => ({ ...a, image: image(a.id) })),
  };
  return (
    <section id="how" className="relative scroll-mt-16 py-24">
      <div className="reveal mx-auto max-w-6xl px-4">
        <SectionHeading title={t.home.liveTitle} sub={t.home.liveSub} />
        <div className="mt-14">
          <RunDemo run={demo} />
        </div>
      </div>
    </section>
  );
}

function HowItWorks({ t }: { t: Messages }) {
  return (
    <section id="how" className="scroll-mt-16 bg-surface py-20">
      <div className="reveal mx-auto max-w-6xl px-4">
        <SectionHeading title={t.home.howTitle} sub={t.home.howSub} />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {t.home.steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-line bg-raised p-6"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent">
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

function Examples({
  t,
  locale,
  runs,
}: {
  t: Messages;
  locale: Locale;
  runs: ShowcaseRun[];
}) {
  const all = runs.flatMap((r) => r.ads);
  const rows = [
    all.filter((a) => a.aspect === "9:16"),
    all.filter((a) => a.aspect === "1:1"),
  ].filter((row) => row.length > 0);
  return (
    <section className="reveal overflow-hidden py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title={t.home.examplesTitle} sub={t.home.examplesSub} />
      </div>
      <div className="mt-14 flex flex-col gap-5">
        {rows.map((row, r) => (
          <div key={r} className="marquee">
            <div
              className={`marquee-track ${r % 2 ? "reverse" : ""}`}
              style={{ "--marquee-s": `${row.length * 6}s` } as CSSProperties}
            >
              {/* Twice, so the loop never shows a gap. */}
              {[...row, ...row].map((a, i) => (
                <Image
                  key={i}
                  src={image(a.id)}
                  alt={i < row.length ? a.headline : ""}
                  width={1080}
                  height={a.aspect === "9:16" ? 1920 : 1080}
                  sizes={
                    a.aspect === "9:16"
                      ? "(min-width: 40rem) 214px, 169px"
                      : "(min-width: 40rem) 260px, 220px"
                  }
                  className={`shrink-0 rounded-2xl border border-line object-cover shadow-[0_20px_50px_-30px_rgb(var(--t-shadow)/0.5)] ${
                    a.aspect === "9:16"
                      ? "h-[300px] w-[169px] sm:h-[380px] sm:w-[214px]"
                      : "h-[220px] w-[220px] sm:h-[260px] sm:w-[260px]"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center">
        <Link
          href={localePath(locale, "/use-cases")}
          className="text-sm font-medium text-accent hover:underline"
        >
          {t.home.examplesLink}
        </Link>
      </p>
    </section>
  );
}

function VideoAds({ t, ads }: { t: Messages; ads: FeedAd[] }) {
  return (
    <section className="reveal mx-auto max-w-6xl px-4 py-20">
      <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative flex justify-center">
          <div className="phone-halo" aria-hidden />
          <PhoneFeed
            ads={ads}
            sizes="(min-width: 40rem) 300px, 260px"
            bare
            className="w-[260px] sm:w-[300px]"
          />
        </div>
        <div className="text-center lg:text-left">
          <p className="text-sm font-medium text-accent">
            {t.home.videoKicker}
          </p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
            {t.home.videoTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-lg text-muted lg:mx-0">
            {t.home.videoIntro}
          </p>
          <ul className="mx-auto mt-8 max-w-lg space-y-5 text-left lg:mx-0">
            {t.home.videoPoints.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs text-accent">
                  ✓
                </span>
                <span>
                  <span className="block font-medium">
                    {fmt(p.title, COUNTS)}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {fmt(p.body, COUNTS)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// What every run includes, each shown rather than told. Real run data where
// there is a run to show.
function Features({ t, run }: { t: Messages; run?: ShowcaseRun }) {
  return (
    <section className="reveal mx-auto max-w-6xl px-4 pb-24">
      <SectionHeading title={t.home.featuresTitle} sub={t.home.featuresSub} />
      <div className="stagger mt-14 grid gap-5 md:grid-cols-6">
        <div className="edge spot lift p-7 md:col-span-4">
          <h3 className="text-lg font-medium">{t.home.briefTitle}</h3>
          <p className="mt-1.5 text-sm text-muted">{t.home.briefBody}</p>
          {run?.audience && (
            <figure className="mt-6 rounded-xl bg-surface p-5">
              <blockquote className="text-[15px] leading-relaxed">
                “{run.audience}”
              </blockquote>
              <figcaption className="mt-3 text-xs text-muted">
                {fmt(t.home.briefCaption, { store: run.store })}
              </figcaption>
            </figure>
          )}
        </div>

        <div className="edge spot lift p-7 md:col-span-2">
          <h3 className="text-lg font-medium">{t.home.kitTitle}</h3>
          <p className="mt-1.5 text-sm text-muted">{t.home.kitBody}</p>
          <div className="mt-6 flex items-center gap-3" aria-hidden>
            {["#16171d", "#4f46e5", "#e9e4da", "#8fa89a"].map((c) => (
              <span
                key={c}
                className="h-9 w-9 rounded-full border border-line shadow-sm"
                style={{ background: c }}
              />
            ))}
            <span className="ml-1 font-serif text-2xl">Aa</span>
          </div>
        </div>

        <div className="edge spot lift p-7 md:col-span-6">
          <h3 className="text-lg font-medium">{t.home.languagesTitle}</h3>
          <p className="mt-1.5 text-sm text-muted">{t.home.languagesBody}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {Object.values(LANGUAGES).map((l) => (
              <li
                key={l.code}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm"
              >
                <span className="mr-1.5 font-mono text-xs uppercase text-accent">
                  {l.code}
                </span>
                <span lang={l.code}>{l.native}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Pricing({ t, locale }: { t: Messages; locale: Locale }) {
  return (
    <section id="pricing" className="scroll-mt-16 bg-surface py-20">
      <div className="reveal mx-auto max-w-6xl px-4">
        <SectionHeading title={t.home.pricingTitle} sub={t.home.pricingSub} />
        <div className="stagger mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`spot lift flex flex-col p-7 ${
                i === FEATURED
                  ? "edge shadow-[0_30px_80px_-30px_var(--t-accent)] lg:-my-3 lg:py-10"
                  : "rounded-2xl border border-line bg-raised"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{plan.name}</h3>
                {i === FEATURED && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                    {t.home.popular}
                  </span>
                )}
              </div>
              <p className="mt-4">
                <span className="text-5xl font-semibold tracking-tight">
                  {usd(PRICES[i], locale)}
                </span>
                {i > 0 && <span className="text-muted">{t.home.perMonth}</span>}
              </p>
              <LocalPrice
                usd={PRICES[i]}
                locale={locale}
                template={t.home.approx}
                className="text-sm text-muted"
              />
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
                className={`mt-8 rounded-xl px-5 py-2.5 text-center text-sm font-medium transition ${
                  i === FEATURED
                    ? "btn-primary"
                    : "border border-line text-fg hover:bg-surface"
                }`}
              >
                {t.nav.getStarted}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted">{t.home.payNote}</p>
      </div>
    </section>
  );
}

function Faq({ t }: { t: Messages }) {
  return (
    <section
      id="faq"
      className="reveal mx-auto max-w-3xl scroll-mt-16 px-4 py-20"
    >
      <SectionHeading title={t.home.faqTitle} />
      <div className="mt-10 divide-y divide-line border-y border-line">
        {t.home.faq.map((item) => (
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
            <p className="mt-3 leading-relaxed text-muted">
              {fmt(item.a, COUNTS)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ t }: { t: Messages }) {
  return (
    <section className="px-4 pb-24">
      <div className="cta-panel relative mx-auto flex max-w-6xl flex-col items-center overflow-hidden rounded-[2rem] px-6 py-20 text-center text-white shadow-[0_40px_120px_-40px_#4f46e5]">
        <div className="grid-fade opacity-40" aria-hidden />
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {t.home.finalTitle}
        </h2>
        <p className="mt-4 text-lg text-white/80">{t.home.finalSub}</p>
        <form
          action="/dashboard"
          method="get"
          className="mt-9 flex w-full max-w-xl flex-col gap-2 rounded-2xl bg-white/10 p-2 ring-1 ring-white/25 backdrop-blur sm:flex-row"
        >
          <label htmlFor="url-bottom" className="sr-only">
            {t.urlForm.label}
          </label>
          <input
            id="url-bottom"
            name="url"
            type="text"
            inputMode="url"
            placeholder={t.urlForm.placeholder}
            className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-[#0f1222] outline-none placeholder:text-[#596078]"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#0f1222] px-6 py-3 font-medium text-white transition hover:bg-black"
          >
            {t.urlForm.submit}
          </button>
        </form>
      </div>
    </section>
  );
}
