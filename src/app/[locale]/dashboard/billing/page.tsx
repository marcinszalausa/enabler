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
  discountPlan,
  paymentsOpen,
  type PackKey,
  type PlanKey,
} from "@/lib/billing";
import {
  MAX_PACK_DISCOUNT,
  MONEY_BACK_DAYS,
  PACK_DISCOUNTS,
  YEARLY_DISCOUNT,
  packPrice,
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
import {
  AutoReloadForm,
  CancelPlanButton,
  Modal,
  TurnOffButton,
} from "./billing-dialogs";
import { MAX_RELOADS_PER_MONTH, RELOAD_THRESHOLDS } from "@/lib/auto-reload";
import { formatAmount, listInvoices } from "@/lib/invoices";

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
      "id, plan, credits, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, auto_reload_enabled, auto_reload_threshold, auto_reload_pack, auto_reload_error",
    )
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) return null;
  const [{ data: activity }, { data: used }, invoices] = await Promise.all([
    supabase.rpc("credit_activity", { ws: ws.id, max_rows: 30 }),
    supabase.rpc("credits_used_recently", { ws: ws.id, days: 30 }),
    listInvoices(ws.stripe_customer_id),
  ]);
  const history = (activity ?? []) as Activity[];
  const open = paymentsOpen();

  const b = t.billing;
  const n = (value: number) => value.toLocaleString(locale);
  const subscribed = Boolean(ws.stripe_subscription_id);
  // Packs cost less on a paid plan (src/lib/pricing.ts).
  const pricePlan = discountPlan(ws);
  const discount = PACK_DISCOUNTS[pricePlan];
  const packFor = (key: PackKey) => packPrice(PACKS[key].usd, pricePlan);
  const reloadPack = (
    ws.auto_reload_pack in PACKS ? ws.auto_reload_pack : "small"
  ) as PackKey;
  const day = (seconds: number) =>
    new Date(seconds * 1000).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const status: Record<string, string> = {
    paid: b.statusPaid,
    open: b.statusOpen,
    void: b.statusVoid,
    uncollectible: b.statusUnpaid,
  };
  const row =
    "flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6";
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
      {(checkout === "success" ||
        checkout === "pack" ||
        checkout === "reload") && (
        <p className="mt-6 rounded-xl border border-green-600/30 bg-green-600/10 p-4 text-sm">
          {checkout === "pack"
            ? b.packPaid
            : checkout === "reload"
              ? b.reloadSaved
              : b.paid}
        </p>
      )}

      <section className="edge mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm text-muted">{b.currentPlan}</p>
          <p className="mt-1 text-xl font-semibold">{planName(t, ws.plan)}</p>
          <p className="mt-1 text-sm text-muted">
            {subscribed && renews
              ? ws.subscription_status === "past_due"
                ? b.pastDue
                : `${fmt(b.renews, { date: renews })} ${b.rollover}`
              : fmt(b.freeNote, { count: n(FREE_PLAN.credits) })}
          </p>
        </div>
        {subscribed && (
          <ManageButton label={b.manage} pendingLabel={b.opening} secondary />
        )}
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

      <section
        data-credit-wallet
        className="mt-10 divide-y divide-line rounded-2xl border border-line bg-raised"
      >
        <div className={row}>
          <div>
            <p
              className={`text-3xl font-semibold tracking-tight tabular-nums ${
                ws.credits < LOW_CREDITS ? "text-warn" : ""
              }`}
            >
              {fmt(t.app.credits, { count: n(ws.credits) })}
            </p>
            <p className="mt-1 text-sm text-muted">
              {b.balanceLabel} ·{" "}
              {fmt(b.packAds, { ads: n(adsFor(ws.credits)) })} ·{" "}
              {fmt(b.usedRecently, { count: n(Number(used ?? 0)) })}
            </p>
            {ws.credits < LOW_CREDITS && !subscribed && (
              <p className="mt-2 text-sm font-medium text-warn">{b.lowNote}</p>
            )}
          </div>
          <Modal
            label={b.buyCredits}
            badge={
              discount > 0
                ? fmt(b.planDiscount, {
                    percent: Math.round(discount * 100),
                    plan: planName(t, pricePlan),
                  })
                : fmt(b.upTo, { percent: Math.round(MAX_PACK_DISCOUNT * 100) })
            }
            title={b.packsTitle}
            closeLabel={b.close}
            hash="packs"
            variant="primary"
          >
            <p className="mt-1 text-sm text-muted">{b.packsSub}</p>
            <div className="mt-5 flex flex-col gap-3">
              {(Object.keys(PACKS) as PackKey[]).map((key) => {
                const pack = PACKS[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 rounded-xl border border-line bg-raised p-4"
                  >
                    <div>
                      <h3 className="font-medium">
                        {fmt(b.pack, { count: n(pack.credits) })}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {fmt(b.packAds, { ads: n(adsFor(pack.credits)) })}
                      </p>
                      <LocalPrice
                        usd={packFor(key)}
                        locale={locale}
                        template={t.home.approx}
                        className="mt-0.5 block text-xs text-muted"
                      />
                    </div>
                    <CheckoutButton
                      kind="pack"
                      value={key}
                      label={fmt(b.buy, { price: usd(packFor(key), locale) })}
                      pendingLabel={b.openingCheckout}
                      primary
                      disabled={!open}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-muted">
              {discount > 0
                ? fmt(b.planDiscountNote, {
                    percent: Math.round(discount * 100),
                    plan: planName(t, pricePlan),
                  })
                : fmt(b.discountTeaser, {
                    percent: Math.round(MAX_PACK_DISCOUNT * 100),
                  })}
            </p>
          </Modal>
        </div>

        <div
          className={row}
          data-auto-reload={ws.auto_reload_enabled ? "on" : "off"}
        >
          <div className="max-w-xl">
            <p className="font-medium">{b.autoTitle}</p>
            <p className="mt-1 text-sm text-muted">
              {ws.auto_reload_enabled
                ? fmt(b.autoOn, {
                    threshold: n(ws.auto_reload_threshold),
                    count: n(PACKS[reloadPack].credits),
                    price: usd(packFor(reloadPack), locale),
                  })
                : b.autoOff}
            </p>
            {!ws.auto_reload_enabled && ws.auto_reload_error && (
              <p className="mt-2 text-sm font-medium text-warn">
                {b.autoFailed}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ws.auto_reload_enabled && (
              <TurnOffButton label={b.turnOff} pendingLabel={b.opening} />
            )}
            <Modal
              label={ws.auto_reload_enabled ? b.change : b.turnOn}
              title={b.autoTitle}
              closeLabel={b.close}
            >
              <AutoReloadForm
                thresholds={RELOAD_THRESHOLDS.map((value) => ({
                  value,
                  label: fmt(t.app.credits, { count: n(value) }),
                }))}
                packs={(Object.keys(PACKS) as PackKey[]).map((key) => ({
                  value: key,
                  label: `${fmt(b.pack, { count: n(PACKS[key].credits) })} · ${usd(packFor(key), locale)}`,
                }))}
                defaultThreshold={ws.auto_reload_threshold}
                defaultPack={reloadPack}
                thresholdLabel={b.autoThreshold}
                packLabel={b.autoPack}
                note={fmt(b.autoNote, { max: MAX_RELOADS_PER_MONTH })}
                saveLabel={b.autoSave}
                pendingLabel={b.opening}
                disabled={!open}
              />
            </Modal>
          </div>
        </div>
      </section>

      <section className="mt-10" data-invoices>
        <h2 className="text-lg font-medium">{b.invoicesTitle}</h2>
        {invoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{b.invoicesEmpty}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-raised">
            <table className="w-full min-w-[28rem] text-start text-sm">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 text-start font-medium">
                    {b.colDate}
                  </th>
                  <th className="px-5 py-3 text-start font-medium">
                    {b.colTotal}
                  </th>
                  <th className="px-5 py-3 text-start font-medium">
                    {b.colStatus}
                  </th>
                  <th className="px-5 py-3 text-start font-medium">
                    {b.colActions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-5 py-3">{day(invoice.created)}</td>
                    <td className="px-5 py-3 tabular-nums">
                      {formatAmount(invoice.total, invoice.currency, locale)}
                    </td>
                    <td className="px-5 py-3">
                      {status[invoice.status] ?? invoice.status}
                    </td>
                    <td className="px-5 py-3">
                      {invoice.pdf && (
                        <a
                          href={invoice.pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4"
                        >
                          {b.downloadPdf}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {subscribed && (
        <section className="mt-10" data-cancellation>
          <h2 className="text-lg font-medium">{b.cancelTitle}</h2>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-raised px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="font-medium">{b.cancelPlan}</p>
              <p className="mt-1 text-sm text-muted">{b.cancelNote}</p>
            </div>
            <CancelPlanButton label={b.cancelButton} pendingLabel={b.opening} />
          </div>
        </section>
      )}

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
    case "reload":
      return b.historyReload;
    case "adjust":
      return b.historyAdjust;
    default:
      return b.historyFree;
  }
}
