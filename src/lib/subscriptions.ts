import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { PACKS, PLANS, isPackKey, planForPrice } from "@/lib/billing";

// Statuses that keep the paid plan. past_due keeps it while Stripe retries
// the card; Stripe cancels the subscription if the retries fail.
const LIVE_STATUSES: Stripe.Subscription.Status[] = [
  "active",
  "trialing",
  "past_due",
];

function customerId(customer: string | { id: string }): string {
  return typeof customer === "string" ? customer : customer.id;
}

function periodEnd(item: Stripe.SubscriptionItem | undefined) {
  return item ? new Date(item.current_period_end * 1000).toISOString() : null;
}

// Copies a subscription's plan, billing interval and status onto its
// workspace.
export async function syncSubscription(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const match = item ? planForPrice(item.price.id) : null;
  const live = LIVE_STATUSES.includes(sub.status) && match !== null;

  const update = createAdminClient()
    .from("workspaces")
    .update({
      plan: live ? match.plan : "free",
      billing_interval: live ? match.interval : null,
      // Monthly plans get credits with each invoice; only yearly ones keep a
      // date for the next month's credits.
      ...(!(live && match.interval === "year") && { next_credit_at: null }),
      stripe_subscription_id: live ? sub.id : null,
      subscription_status: sub.status,
      current_period_end: periodEnd(item),
      ...(live && { had_subscription: true }),
    })
    .eq("stripe_customer_id", customerId(sub.customer));

  // An ended or unfinished subscription only downgrades the workspace if it
  // is the one on file, so an old one can't undo a newer one.
  const { error } = live
    ? await update
    : await update.eq("stripe_subscription_id", sub.id);
  if (error) throw error;
}

// The same day next month, for yearly plans' monthly credits.
function nextMonth(from = new Date()) {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

// A paid subscription invoice. A first payment or a renewal grants a month
// of the plan's credits (unused ones from last month roll over once); a
// mid-period upgrade adds the difference between the two plans.
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const ref = invoice.parent?.subscription_details?.subscription;
  if (!ref || !invoice.customer || !invoice.id) return;

  const sub = await stripe().subscriptions.retrieve(
    typeof ref === "string" ? ref : ref.id,
  );
  await syncSubscription(sub);

  const item = sub.items.data[0];
  const match = item ? planForPrice(item.price.id) : null;
  if (!match) return;

  const admin = createAdminClient();
  const { data: ws, error } = await admin
    .from("workspaces")
    .select("id, stripe_subscription_id")
    .eq("stripe_customer_id", customerId(invoice.customer))
    .maybeSingle();
  if (error) throw error;
  if (!ws || ws.stripe_subscription_id !== sub.id) return;

  const allowance = PLANS[match.plan].credits;
  const reason = invoice.billing_reason;
  if (reason === "subscription_create" || reason === "subscription_cycle") {
    const { error: grantError } = await admin.rpc("grant_plan_credits", {
      ws: ws.id,
      grant_key: invoice.id,
      allowance,
      // Yearly plans get the rest of the year's credits month by month.
      next_credit: match.interval === "year" ? nextMonth() : null,
    });
    if (grantError) throw grantError;
  } else if (reason === "subscription_update") {
    const { error: grantError } = await admin.rpc("grant_plan_upgrade", {
      ws: ws.id,
      grant_key: invoice.id,
      allowance,
    });
    if (grantError) throw grantError;
    // Switched from monthly to yearly: monthly credits continue from here.
    if (match.interval === "year") {
      const { error: dateError } = await admin
        .from("workspaces")
        .update({ next_credit_at: nextMonth() })
        .eq("id", ws.id)
        .is("next_credit_at", null);
      if (dateError) throw dateError;
    }
  }
}

// A finished one-time Checkout for a credit pack. Cards are paid at once;
// bank methods such as SEPA Debit confirm later, with
// checkout.session.async_payment_succeeded, which also lands here.
export async function handlePackCheckout(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return;
  const pack = session.metadata?.pack;
  const workspaceId = session.metadata?.workspace_id;
  if (!isPackKey(pack) || !workspaceId) return;

  const { error } = await createAdminClient().rpc("grant_pack_credits", {
    ws: workspaceId,
    session_id: session.id,
    amount: PACKS[pack].credits,
  });
  if (error) throw error;
}
