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
  type PackKey,
  type PlanKey,
} from "@/lib/billing";
import { planName, usd } from "@/lib/pricing";
import { BackLink } from "../ui";
import { CheckoutButton, ManageButton } from "./billing-buttons";

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

// One image ad uses one credit.
const adsFor = (credits: number) => Math.round(credits / 2);

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
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select(
      "plan, credits, stripe_subscription_id, subscription_status, current_period_end",
    )
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) return null;

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

  return (
    <>
      {(checkout === "success" || checkout === "pack") && (
        <p className="mt-6 rounded-xl border border-green-600/30 bg-green-600/10 p-4 text-sm">
          {checkout === "pack" ? b.packPaid : b.paid}
        </p>
      )}

      <section className="edge mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm text-muted">{b.currentPlan}</p>
          <p className="mt-1 text-xl font-semibold">
            {planName(t, ws.plan)} ·{" "}
            {fmt(t.app.credits, { count: n(ws.credits) })}
          </p>
          <p className="mt-1 text-sm text-muted">
            {subscribed && renews
              ? ws.subscription_status === "past_due"
                ? b.pastDue
                : fmt(b.renews, { date: renews })
              : fmt(b.freeNote, { count: n(FREE_PLAN.credits) })}
          </p>
        </div>
        {subscribed && (
          <ManageButton label={b.manage} pendingLabel={b.opening} />
        )}
      </section>

      {!subscribed && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">{b.plansTitle}</h2>
          <p className="mt-1 text-sm text-muted">{b.plansSub}</p>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            {(Object.keys(PLANS) as PlanKey[]).map((key, i) => {
              const plan = PLANS[key];
              const name = planName(t, key);
              return (
                <div
                  key={key}
                  className="flex flex-col rounded-2xl border border-line bg-raised p-6"
                >
                  <h3 className="font-medium">{name}</h3>
                  <p className="mt-3">
                    <span className="text-3xl font-semibold tracking-tight">
                      {usd(plan.usd, locale)}
                    </span>
                    <span className="text-muted">{t.home.perMonth}</span>
                  </p>
                  <p className="mt-1 flex-1 text-sm text-muted">
                    {fmt(b.monthly, {
                      count: n(plan.credits),
                      ads: n(adsFor(plan.credits)),
                    })}
                  </p>
                  <div className="mt-6">
                    <CheckoutButton
                      kind="plan"
                      value={key}
                      label={fmt(b.choose, { plan: name })}
                      pendingLabel={b.openingCheckout}
                      primary={i === 0}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-10">
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
                </div>
                <CheckoutButton
                  kind="pack"
                  value={key}
                  label={fmt(b.buy, { price: usd(pack.usd, locale) })}
                  pendingLabel={b.openingCheckout}
                />
              </div>
            );
          })}
        </div>
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
