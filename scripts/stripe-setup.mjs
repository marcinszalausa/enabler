// Sets up Stripe for Gooidy in one go: a product and monthly USD price per
// plan, the webhook endpoint and the customer portal. Safe to run again; it
// reuses what is already there.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs https://gooidy.com
//
// Prints the environment variables to add in Vercel. Plan prices must match
// src/lib/pricing.ts and credits src/lib/billing.ts.
import Stripe from "stripe";

const PLANS = [
  { key: "starter", name: "Gooidy Starter", usd: 29, credits: 300 },
  { key: "plus", name: "Gooidy Plus", usd: 49, credits: 600 },
  { key: "growth", name: "Gooidy Growth", usd: 79, credits: 1000 },
];

const EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
];

const key = process.env.STRIPE_SECRET_KEY;
const site = (process.argv[2] ?? "").replace(/\/$/, "");
if (!key || !/^https:\/\//.test(site)) {
  console.error(
    "Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs https://your-domain",
  );
  process.exit(1);
}
const stripe = new Stripe(key);
const env = {};

// 1. Plans: one product and one monthly price each, found by lookup key.
const products = [];
for (const plan of PLANS) {
  const lookup = `gooidy_${plan.key}_monthly`;
  const amount = plan.usd * 100;
  const { data } = await stripe.prices.list({
    lookup_keys: [lookup],
    expand: ["data.product"],
  });
  let price = data[0];
  if (price && price.unit_amount !== amount) {
    // The price changed: add a new one and move the lookup key to it.
    // Existing subscribers stay on the old price until they switch.
    price = await stripe.prices.create({
      product: price.product.id,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval: "month" },
      lookup_key: lookup,
      transfer_lookup_key: true,
    });
    console.log(`Updated ${plan.name} to $${plan.usd}/month`);
  } else if (!price) {
    const product = await stripe.products.create({
      name: plan.name,
      description: `${plan.credits.toLocaleString("en-US")} credits every month`,
      metadata: { plan: plan.key },
    });
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval: "month" },
      lookup_key: lookup,
    });
    console.log(`Created ${plan.name} at $${plan.usd}/month`);
  } else {
    console.log(`${plan.name} is already set up`);
  }
  const productId =
    typeof price.product === "string" ? price.product : price.product.id;
  products.push({ product: productId, prices: [price.id] });
  env[`STRIPE_PRICE_${plan.key.toUpperCase()}`] = price.id;
}

// 2. Webhook endpoint.
const url = `${site}/api/stripe/webhook`;
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const existing = endpoints.data.find((e) => e.url === url);
if (existing) {
  await stripe.webhookEndpoints.update(existing.id, { enabled_events: EVENTS });
  console.log(
    `Webhook ${url} already exists; its events are updated. Its signing secret is under Developers > Webhooks in Stripe.`,
  );
} else {
  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: EVENTS,
    description: "Gooidy billing",
  });
  env.STRIPE_WEBHOOK_SECRET = created.secret;
  console.log(`Created webhook ${url}`);
}

// 3. Customer portal: switch plans, update the card, see invoices, cancel.
const portal = {
  business_profile: {
    headline: "Manage your Gooidy plan",
    privacy_policy_url: `${site}/privacy`,
    terms_of_service_url: `${site}/terms`,
  },
  default_return_url: `${site}/dashboard/billing`,
  features: {
    customer_update: {
      enabled: true,
      allowed_updates: ["email", "address", "tax_id"],
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products,
    },
  },
};
const configs = await stripe.billingPortal.configurations.list({
  is_default: true,
  limit: 1,
});
if (configs.data[0]) {
  await stripe.billingPortal.configurations.update(configs.data[0].id, portal);
  console.log("Updated the customer portal");
} else {
  const created = await stripe.billingPortal.configurations.create(portal);
  env.STRIPE_PORTAL_CONFIGURATION = created.id;
  console.log("Created the customer portal");
}

console.log("\nAdd these in Vercel > Settings > Environment Variables:\n");
console.log(`STRIPE_SECRET_KEY=${key.slice(0, 8)}… (the key you used)`);
for (const [name, value] of Object.entries(env))
  console.log(`${name}=${value}`);
console.log(
  "\nThen in Stripe turn on Adaptive Pricing (Settings > Payments > Adaptive Pricing) and the payment methods you want (Settings > Payments > Payment methods).",
);
