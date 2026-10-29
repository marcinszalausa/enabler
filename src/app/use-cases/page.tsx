import Link from "next/link";
import {
  THEME_BY_TIME,
  Nav,
  UrlForm,
  SectionHeading,
  Footer,
} from "../_landing/chrome";
import { Reveal } from "../_landing/reveal";
import { getShowcase, type ShowcaseRun } from "@/lib/showcase";
import { RunViewer } from "./run-viewer";

export const metadata = {
  title: "Real examples · Gooidy",
  description:
    "Real, unedited ads Gooidy made from real product links. See every angle and size, then try it on your own store for free.",
};

export default async function UseCases() {
  const runs = await getShowcase();
  const adCount = runs.reduce((n, r) => n + r.ads.length, 0);
  const times = runs.flatMap((r) => (r.seconds ? [r.seconds] : []));

  return (
    <div className="landing flex flex-1 flex-col bg-bg text-fg">
      <script dangerouslySetInnerHTML={{ __html: THEME_BY_TIME }} />
      <Nav />
      <main className="flex-1">
        <section className="hero-bg">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-14 pt-14 text-center sm:pt-20">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-sm text-muted shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Real runs, unedited
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              See exactly what you get from{" "}
              <span className="text-accent">one link</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
              We pasted real product pages into Gooidy. Everything below is what
              came out: every ad from each run, with no designer and no
              retouching.
            </p>
            {runs.length > 0 && (
              <dl className="mt-10 grid w-full max-w-lg grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-bg">
                <Stat label="Product links" value={String(runs.length)} />
                <Stat label="Ads made" value={String(adCount)} />
                <Stat
                  label="Per link"
                  value={times.length ? `~${duration(average(times))}` : "—"}
                />
              </dl>
            )}
          </div>
        </section>

        {runs.length === 0 ? (
          <HowARunWorks />
        ) : (
          runs.map((run, i) => <Run key={run.id} run={run} index={i} />)
        )}

        <section className="border-t border-line bg-surface px-4 py-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
              Now try your own store
            </h2>
            <p className="mt-3 text-lg text-muted">
              Paste a product link. You get 5 angles in feed and story sizes,
              with the ad text written. Your first runs are free.
            </p>
            <div className="mt-8 flex w-full justify-center">
              <UrlForm id="url-use-cases" />
            </div>
            <p className="mt-4 text-sm text-muted">
              Works with Shopify, WooCommerce and most product pages.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <Reveal />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

function Run({ run, index }: { run: ShowcaseRun; index: number }) {
  return (
    <section
      className={`reveal px-4 py-16 sm:py-20 ${index > 0 ? "border-t border-line" : ""}`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted">Example {index + 1}</p>
            <h2 className="mt-1 text-3xl font-medium tracking-tight">
              {run.productName}
            </h2>
          </div>
          <a
            href={run.productUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent hover:underline"
          >
            See the real product page on {run.store} ↗
          </a>
        </div>
        <RunViewer
          run={run}
          took={run.seconds ? duration(run.seconds) : null}
        />
      </div>
    </section>
  );
}

// Shown until the team picks real runs to feature.
function HowARunWorks() {
  const steps = [
    ["Paste a link", "Any product or store page."],
    [
      "Gooidy reads it",
      "Product, price, audience, the problems it solves and your brand style.",
    ],
    [
      "You get 10 ads",
      "5 angles, each in feed (1:1) and story (9:16) size, with the text written.",
    ],
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <SectionHeading title="What one run gives you" />
      <ol className="mt-12 grid gap-6 sm:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="rounded-2xl border border-line p-6">
            <p className="text-sm text-accent">Step {i + 1}</p>
            <p className="mt-2 font-medium">{title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/dashboard" className="text-accent hover:underline">
          Try it on your own link →
        </Link>
      </p>
    </section>
  );
}

const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function duration(seconds: number) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}
