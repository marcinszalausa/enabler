import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { PLANS, planForPrice } from "@/lib/billing";

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

// Copies a subscription's plan and status onto its workspace.
export async function syncSubscription(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const item = sub.items.data[0];
  const plan = item ? planForPrice(item.price.id) : null;
  const live = LIVE_STATUSES.includes(sub.status) && plan !== null;

  const update = admin
    .from("workspaces")
    .update({
      plan: live ? plan : "free",
      stripe_subscription_id: live ? sub.id : null,
      subscription_status: sub.status,
      current_period_end: item
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
    })
    .eq("stripe_customer_id", customerId(sub.customer));

  // An ended or unfinished subscription only downgrades the workspace if it
  // is the one on file, so an old one can't undo a newer one.
  const { error } = live ? await update : await update.eq("stripe_subscription_id", sub.id);
  if (error) throw error;
}

// A paid subscription invoice (first payment, renewal or plan change):
// refresh the plan and top credits up to its monthly allowance.
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const ref = invoice.parent?.subscription_details?.subscription;
  if (!ref || !invoice.customer) return;

  const sub = await stripe().subscriptions.retrieve(
    typeof ref === "string" ? ref : ref.id,
  );
  await syncSubscription(sub);

  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? planForPrice(priceId) : null;
  if (!plan) return;

  const admin = createAdminClient();
  const { data: ws, error } = await admin
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId(invoice.customer))
    .maybeSingle();
  if (error) throw error;
  if (!ws) return;

  const { error: grantError } = await admin.rpc("grant_plan_credits", {
    ws: ws.id,
    allowance: PLANS[plan].credits,
  });
  if (grantError) throw grantError;
}
