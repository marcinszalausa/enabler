"use server";

import type Stripe from "stripe";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { PACKS, isPackKey, isPlanKey, priceIdFor } from "@/lib/billing";
import { UserError, userMessage } from "@/lib/errors";
import { requestLocale, requestMessages } from "@/i18n/server";
import type { Locale } from "@/i18n/config";

export type BillingState = { error: string | null };

// Billing changes are for the workspace owner only.
async function ownerWorkspace() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const t = (await requestMessages()).billing.errors;
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, stripe_customer_id, stripe_subscription_id")
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) throw new UserError(t.noWorkspace);

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", auth.user.id)
    .single();
  if (member?.role !== "owner") throw new UserError(t.ownerOnly);
  return { ws, email: auth.user.email };
}

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

// Stripe's pages in the visitor's language. Stripe has no Hindi or Arabic,
// so those fall back to the buyer's browser language.
const STRIPE_LOCALES: Partial<
  Record<Locale, Stripe.Checkout.SessionCreateParams.Locale>
> = {
  en: "en",
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  it: "it",
  pl: "pl",
  nl: "nl",
  sv: "sv",
  tr: "tr",
  ro: "ro",
  cs: "cs",
  ja: "ja",
  ko: "ko",
  zh: "zh",
};

async function stripeLocale() {
  return STRIPE_LOCALES[await requestLocale()] ?? "auto";
}

// Settings shared by plan and pack checkouts. Prices are in USD; Adaptive
// Pricing shows each buyer their own currency and Stripe pays out dollars.
// Leaving out payment_method_types lets Stripe offer every method turned on
// in the Dashboard that fits the buyer's country, currency and the purchase.
async function checkoutBase(
  ws: { id: string; name: string; stripe_customer_id: string | null },
  email: string | undefined,
): Promise<Stripe.Checkout.SessionCreateParams> {
  const tax = process.env.STRIPE_AUTOMATIC_TAX === "on";
  return {
    customer: await customerFor(ws, email),
    client_reference_id: ws.id,
    locale: await stripeLocale(),
    adaptive_pricing: { enabled: true },
    allow_promotion_codes: true,
    cancel_url: `${await siteOrigin()}/dashboard/billing`,
    ...(tax && {
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
    }),
  };
}

// Returns the workspace's Stripe customer, creating it on first use.
async function customerFor(
  ws: {
    id: string;
    name: string;
    stripe_customer_id: string | null;
  },
  email: string | undefined,
) {
  if (ws.stripe_customer_id) return ws.stripe_customer_id;

  const customer = await stripe().customers.create({
    email,
    name: ws.name,
    metadata: { workspace_id: ws.id },
  });
  const admin = createAdminClient();
  // Only fill an empty slot, so two quick clicks can't link two customers.
  await admin
    .from("workspaces")
    .update({ stripe_customer_id: customer.id })
    .eq("id", ws.id)
    .is("stripe_customer_id", null);
  const { data } = await admin
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", ws.id)
    .single();
  return (data?.stripe_customer_id as string) ?? customer.id;
}

export async function startCheckout(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  let url: string | null = null;
  const t = (await requestMessages()).billing.errors;
  try {
    const plan = formData.get("plan");
    if (!isPlanKey(plan)) return { error: t.pickPlan };
    const price = priceIdFor(plan);
    if (!price) throw new UserError(t.notSetUp);

    const { ws, email } = await ownerWorkspace();
    // Already subscribed: plan changes happen in the billing portal.
    if (!ws.stripe_subscription_id) {
      const session = await stripe().checkout.sessions.create({
        ...(await checkoutBase(ws, email)),
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        subscription_data: { metadata: { workspace_id: ws.id } },
        success_url: `${await siteOrigin()}/dashboard/billing?checkout=success`,
      });
      if (!session.url) throw new Error("Checkout session has no URL");
      url = session.url;
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error("startCheckout failed", err);
    return { error: userMessage(err, t.checkout) };
  }
  // redirect() throws, so it stays outside the try above.
  if (!url) return openPortal();
  redirect(url);
}

// A one-time credit pack. One-time payments can use local methods (BLIK,
// iDEAL, PayPal, Pix and more) that Stripe doesn't allow on subscriptions
// paid in another currency.
export async function buyPack(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  let url: string;
  const t = (await requestMessages()).billing.errors;
  try {
    const key = formData.get("pack");
    if (!isPackKey(key)) return { error: t.pickPlan };
    const pack = PACKS[key];

    const { ws, email } = await ownerWorkspace();
    const metadata = { workspace_id: ws.id, pack: key };
    const session = await stripe().checkout.sessions.create({
      ...(await checkoutBase(ws, email)),
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.usd * 100,
            product_data: {
              name: `Gooidy credits: ${pack.credits.toLocaleString("en-US")}`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      // A receipt-style invoice, which businesses need for their books.
      invoice_creation: { enabled: true },
      success_url: `${await siteOrigin()}/dashboard/billing?checkout=pack`,
    });
    if (!session.url) throw new Error("Checkout session has no URL");
    url = session.url;
  } catch (err) {
    unstable_rethrow(err);
    console.error("buyPack failed", err);
    return { error: userMessage(err, t.checkout) };
  }
  redirect(url);
}

export async function openPortal(): Promise<BillingState> {
  let url: string;
  const t = (await requestMessages()).billing.errors;
  try {
    const { ws, email } = await ownerWorkspace();
    const session = await stripe().billingPortal.sessions.create({
      customer: await customerFor(ws, email),
      locale: await stripeLocale(),
      // Set by scripts/stripe-setup.mjs when the account had no portal yet.
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION || undefined,
      return_url: `${await siteOrigin()}/dashboard/billing`,
    });
    url = session.url;
  } catch (err) {
    unstable_rethrow(err);
    console.error("openPortal failed", err);
    return { error: userMessage(err, t.portal) };
  }
  redirect(url);
}
