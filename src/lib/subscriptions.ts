import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import {
  BOOST,
  PACKS,
  PLANS,
  boostPriceId,
  isPackKey,
  isPlanKey,
  planForPrice,
} from "@/lib/billing";

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

// Copies a subscription's plan or Boost and its status onto its workspace.
export async function syncSubscription(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  if (item && item.price.id === boostPriceId()) return syncBoost(sub, item);

  const plan = item ? planForPrice(item.price.id) : null;
  const live = LIVE_STATUSES.includes(sub.status) && plan !== null;

  const update = createAdminClient()
    .from("workspaces")
    .update({
      plan: live ? plan : "free",
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

async function syncBoost(
  sub: Stripe.Subscription,
  item: Stripe.SubscriptionItem,
) {
  const live = LIVE_STATUSES.includes(sub.status);
  const update = createAdminClient()
    .from("workspaces")
    .update({
      boost_subscription_id: live ? sub.id : null,
      boost_until: live ? periodEnd(item) : null,
    })
    .eq("stripe_customer_id", customerId(sub.customer));
  const { error } = live
    ? await update
    : await update.eq("boost_subscription_id", sub.id);
  if (error) throw error;
}

// A paid subscription invoice (the intro payment, a renewal, or Boost).
// Plan invoices top credits up to the plan's allowance; a Boost invoice adds
// Boost's credits once per yearly payment.
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const ref = invoice.parent?.subscription_details?.subscription;
  if (!ref || !invoice.customer) return;

  const sub = await stripe().subscriptions.retrieve(
    typeof ref === "string" ? ref : ref.id,
  );
  await syncSubscription(sub);

  const admin = createAdminClient();
  const { data: ws, error } = await admin
    .from("workspaces")
    .select("id, plan, subscription_status")
    .eq("stripe_customer_id", customerId(invoice.customer))
    .maybeSingle();
  if (error) throw error;
  if (!ws) return;

  if (sub.items.data[0]?.price.id === boostPriceId()) {
    if (invoice.amount_paid <= 0) return;
    // Keyed by invoice, so a repeated webhook can't add the credits twice.
    const { error: boostError } = await admin.rpc("grant_pack_credits", {
      ws: ws.id,
      session_id: invoice.id,
      amount: BOOST.credits,
    });
    if (boostError) throw boostError;
    return;
  }

  // The intro period (a trial in Stripe) gets a smaller allowance; the full
  // monthly credits arrive with the first full-price invoice.
  const planCredits = isPlanKey(ws.plan)
    ? ws.subscription_status === "trialing"
      ? PLANS[ws.plan].intro.credits
      : PLANS[ws.plan].credits
    : 0;
  const allowance = planCredits;
  if (!allowance) return;

  const { error: grantError } = await admin.rpc("grant_plan_credits", {
    ws: ws.id,
    allowance,
  });
  if (grantError) throw grantError;
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
