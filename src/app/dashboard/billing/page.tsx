import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FREE_PLAN, PLANS, planName, type PlanKey } from "@/lib/billing";
import { ManageButton, UpgradeButton } from "./billing-buttons";

export const metadata = { title: "Billing · Gooidy" };

export default function BillingPage({
  searchParams,
}: PageProps<"/dashboard/billing">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-500 underline underline-offset-4"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Plan and billing</h1>
      <Suspense
        fallback={<p className="mt-6 text-sm text-neutral-500">Loading…</p>}
      >
        <Billing searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Billing({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard/billing">["searchParams"];
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

  const subscribed = Boolean(ws.stripe_subscription_id);
  const renews = ws.current_period_end
    ? new Date(ws.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      {checkout === "success" && (
        <p className="mt-6 rounded-md border border-green-600/30 bg-green-600/10 p-4 text-sm">
          Payment received, thank you. Your plan and credits update within a few
          seconds; refresh if they don&apos;t show yet.
        </p>
      )}

      <section className="mt-6 flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
        <div>
          <p className="text-sm text-neutral-500">Current plan</p>
          <p className="mt-1 text-xl font-semibold">
            {planName(ws.plan)} · {ws.credits} credits
          </p>
          {subscribed && renews && (
            <p className="mt-1 text-sm text-neutral-500">
              {ws.subscription_status === "past_due"
                ? "Payment failed. Update your card to keep your plan."
                : `Renews on ${renews}. Credits top up each month.`}
            </p>
          )}
          {!subscribed && (
            <p className="mt-1 text-sm text-neutral-500">
              {FREE_PLAN.credits} credits to start. Upgrade for a monthly
              allowance.
            </p>
          )}
        </div>
        {subscribed && <ManageButton />}
      </section>

      {!subscribed && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          {(Object.keys(PLANS) as PlanKey[]).map((key, i) => {
            const plan = PLANS[key];
            return (
              <div
                key={key}
                className="flex flex-col rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
              >
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="mt-2 text-2xl font-semibold">{plan.price}</p>
                <p className="mt-1 flex-1 text-sm text-neutral-500">
                  {plan.credits.toLocaleString("en-US")} credits every month
                  (about {Math.round(plan.credits / 2)} ads). Cancel anytime.
                </p>
                <div className="mt-6">
                  <UpgradeButton
                    plan={key}
                    label={`Upgrade to ${plan.name}`}
                    primary={i === 0}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <p className="mt-8 text-sm text-neutral-500">
        One credit makes one ad image. Each run makes 5 ads in 2 sizes (10
        credits). Payments are handled securely by Stripe.
      </p>
    </>
  );
}
