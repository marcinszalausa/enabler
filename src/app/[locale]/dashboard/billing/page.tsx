import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getMessages, type Messages } from "@/i18n/messages";
import { fmt } from "@/i18n/format";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  FREE_PLAN,
  PACKS,
  PLANS,
  paymentsOpen,
  type PackKey,
  type PlanKey,
} from "@/lib/billing";
import {
  MONEY_BACK_DAYS,
  YEARLY_DISCOUNT,
  planName,
  usd,
  yearlyPrice,
} from "@/lib/pricing";
import { CREDITS_PER_IMAGE } from "@/lib/image-pricing";
import Link from "next/link";
import { BackLink } from "../ui";
import { LocalPrice } from "@/app/_landing/local-price";
import { CheckoutButton, ManageButton } from "./billing-buttons";
import { LOW_CREDITS } from "../credits-link";

type Activity = {
  happened_at: string;
  kind: string;
  credits: number;
  product: string | null;
  status: string | null;
};

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard/billing">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: `${(await getMessages(locale)).billing.title} · Gooidy` };
}

export default async function BillingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/billing">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <BackLink href="/dashboard">{t.app.dashboard}</BackLink>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        {t.billing.title}
      </h1>
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted">{t.app.loading}</p>}
      >
        <Billing t={t} locale={locale} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const adsFor = (credits: number) => Math.floor(credits / CREDITS_PER_IMAGE);

async function Billing({
  t,
  locale,
  searchParams,
}: {
  t: Messages;
  locale: Locale;
  searchParams: PageProps<"/[locale]/dashboard/billing">["searchParams"];
}) {
  await getCurrentUser();
  const { checkout, interval: wanted } = await searchParams;
  const yearly = wanted === "year";
  const supabase = await createClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select(
      "id, plan, credits, stripe_subscription_id, subscription_status, current_period_end",
    )
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) return null;
  const [{ data: activity }, { data: used }] = await Promise.all([
    supabase.rpc("credit_activity", { ws: ws.id, max_rows: 30 }),
    supabase.rpc("credits_used_recently", { ws: ws.id, days: 30 }),
  ]);
  const history = (activity ?? []) as Activity[];
  const open = paymentsOpen();

  const b = t.billing;
  const n = (value: number) => value.toLocaleString(locale);
  const subscribed = Boolean(ws.stripe_subscription_id);
  const renews = ws.current_period_end
    ? new Date(ws.current_period_end).toLocaleDateString(locale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const tab = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium transition ${
      active ? "bg-raised shadow-sm" : "text-muted hover:text-fg"
    }`;

  return (
    <>
      {(checkout === "success" || checkout === "pack") && (
        <p className="mt-6 rounded-xl border border-green-600/30 bg-green-600/10 p-4 text-sm">
          {checkout === "pack" ? b.packPaid : b.paid}
        </p>
      )}

      <section
        data-credit-wallet
        className="edge mt-6 grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8"
      >
        <div>
          <p className="text-sm text-muted">{b.walletTitle}</p>
          <p
            className={`mt-1 text-4xl font-semibold tracking-tight tabular-nums ${
              ws.credits < LOW_CREDITS ? "text-warn" : ""
            }`}
          >
            {n(ws.credits)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {fmt(b.packAds, { ads: n(adsFor(ws.credits)) })} ·{" "}
            {fmt(b.usedRecently, { count: n(Number(used ?? 0)) })}
          </p>
          {ws.credits < LOW_CREDITS && (
            <p className="mt-3 text-sm font-medium text-warn">{b.lowNote}</p>
          )}
          <p className="mt-4 text-sm">
            <span className="font-medium">
              {fmt(b.planLine, { plan: planName(t, ws.plan) })}
            </span>{" "}
            <span className="text-muted">
              {subscribed && renews
                ? ws.subscription_status === "past_due"
                  ? b.pastDue
                  : `${fmt(b.renews, { date: renews })} ${b.rollover}`
                : fmt(b.freeNote, { count: n(FREE_PLAN.credits) })}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <a
            href="#packs"
            className="btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium"
          >
            {b.buyCredits}
          </a>
          {subscribed && (
            <ManageButton label={b.manage} pendingLabel={b.opening} secondary />
          )}
        </div>
      </section>

      {!open && (
        <p
          role="status"
          data-payments-soon
          className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-muted"
        >
          {b.paymentsSoon}
        </p>
      )}

      {!subscribed && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-line bg-surface p-1">
              <Link
                href="/dashboard/billing"
                prefetch={false}
                className={tab(!yearly)}
                aria-current={!yearly ? "true" : undefined}
              >
                {b.monthlyTab}
              </Link>
              <Link
                href="/dashboard/billing?interval=year"
                prefetch={false}
                className={tab(yearly)}
                aria-current={yearly ? "true" : undefined}
              >
                {b.yearlyTab}
              </Link>
            </div>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
              {fmt(b.yearlySave, { percent: YEARLY_DISCOUNT * 100 })}
            </span>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {(Object.keys(PLANS) as PlanKey[]).map((key, i) => {
              const plan = PLANS[key];
              const name = planName(t, key);
              const perYear = yearlyPrice(plan.usd);
              const shown = yearly
                ? Math.round((perYear / 12) * 100) / 100
                : plan.usd;
              return (
                <div
                  key={key}
                  className={
                    i === 1
                      ? "edge flex flex-col p-6"
                      : "flex flex-col rounded-2xl border border-line bg-raised p-6"
                  }
                >
                  <h2 className="font-medium">{name}</h2>
                  <p className="mt-3">
                    <span className="text-3xl font-semibold tracking-tight">
                      {usd(shown, locale)}
                    </span>
                    <span className="text-muted">{t.home.perMonth}</span>
                  </p>
                  {yearly && (
                    <p className="mt-1 text-sm font-medium">
                      {fmt(b.billedYearly, { price: usd(perYear, locale) })}
                    </p>
                  )}
                  <LocalPrice
                    usd={yearly ? perYear : plan.usd}
                    locale={locale}
                    template={t.home.approx}
                    className="text-sm text-muted"
                  />
                  <p className="mt-2 flex-1 text-sm text-muted">
                    {fmt(b.monthly, {
                      count: n(plan.credits),
                      ads: n(adsFor(plan.credits)),
                    })}{" "}
                    {b.rollover}
                  </p>
                  <div className="mt-6">
                    <CheckoutButton
                      kind="plan"
                      value={key}
                      interval={yearly ? "year" : "month"}
                      label={fmt(b.choose, { plan: name })}
                      pendingLabel={b.openingCheckout}
                      primary={i === 1}
                      disabled={!open}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted">
            {fmt(b.moneyBack, { days: MONEY_BACK_DAYS })}
          </p>
        </section>
      )}

      <section id="packs" className="mt-10 scroll-mt-24">
        <h2 className="text-lg font-medium">{b.packsTitle}</h2>
        <p className="mt-1 text-sm text-muted">{b.packsSub}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {(Object.keys(PACKS) as PackKey[]).map((key) => {
            const pack = PACKS[key];
            return (
              <div
                key={key}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-raised p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-medium">
                    {fmt(b.pack, { count: n(pack.credits) })}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {fmt(b.packAds, { ads: n(adsFor(pack.credits)) })}
                  </p>
                  <LocalPrice
                    usd={pack.usd}
                    locale={locale}
                    template={t.home.approx}
                    className="mt-0.5 block text-xs text-muted"
                  />
                </div>
                <CheckoutButton
                  kind="pack"
                  value={key}
                  label={fmt(b.buy, { price: usd(pack.usd, locale) })}
                  pendingLabel={b.openingCheckout}
                  disabled={!open}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10" data-credit-history>
        <h2 className="text-lg font-medium">{b.historyTitle}</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{b.historyEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-raised">
            {history.map((row, i) => (
              <li
                key={`${row.happened_at}-${i}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{activityLabel(b, row.kind)}</p>
                  <p className="truncate text-muted">
                    {[
                      new Date(row.happened_at).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      }),
                      row.product,
                      row.status === "failed"
                        ? b.historyReturned
                        : row.status === "queued" || row.status === "running"
                          ? b.historyRunning
                          : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-medium tabular-nums ${
                    row.credits > 0 ? "text-accent" : "text-muted"
                  }`}
                >
                  {row.credits > 0 ? "+" : row.credits < 0 ? "−" : ""}
                  {n(Math.abs(row.credits))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-surface/60 p-6">
        <h2 className="font-medium">{b.payTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{b.payBody}</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li className="flex gap-2">
            <span className="text-accent">✓</span>
            {b.payPlans}
          </li>
          <li className="flex gap-2">
            <span className="text-accent">✓</span>
            {b.payPacks}
          </li>
        </ul>
      </section>

      <p className="mt-8 text-sm text-muted">{b.footnote}</p>
    </>
  );
}

function activityLabel(b: Messages["billing"], kind: string) {
  switch (kind) {
    case "image_ads":
      return b.historyImages;
    case "video_ads":
      return b.historyVideo;
    case "redo":
      return b.historyRedo;
    case "plan":
      return b.historyPlan;
    case "pack":
      return b.historyPack;
    case "adjust":
      return b.historyAdjust;
    case "avatar":
      return b.historyAvatar;
    default:
      return b.historyFree;
  }
}
