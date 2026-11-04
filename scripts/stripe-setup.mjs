// Sets up Stripe for Gooidy in one go: Pro (monthly) and Boost (yearly) as
// USD prices, the webhook endpoint and the customer portal. Safe to run
// again; it reuses what is already there.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs https://gooidy.com
//
// Prints the environment variables to add in Vercel. Prices must match
// src/lib/pricing.ts. Pro's intro price and the credit packs are charged
// with inline prices, so they need nothing here.
import Stripe from "stripe";

const PRICES = [
  {
    key: "pro",
    env: "STRIPE_PRICE_PRO",
    name: "Gooidy Pro",
    usd: 79,
    interval: "month",
    description: "1,000 credits every month",
  },
  {
    key: "boost",
    env: "STRIPE_PRICE_BOOST",
    name: "Gooidy Boost",
    usd: 39,
    interval: "year",
    description: "300 extra credits a year on top of Pro",
  },
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

// 1. Pro (monthly) and Boost (yearly): a product and price each, found by
// lookup key.
for (const plan of PRICES) {
  const lookup = `gooidy_${plan.key}_${plan.interval}ly`;
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
      recurring: { interval: plan.interval },
      lookup_key: lookup,
      transfer_lookup_key: true,
    });
    console.log(`Updated ${plan.name} to $${plan.usd}/${plan.interval}`);
  } else if (!price) {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { plan: plan.key },
    });
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval: plan.interval },
      lookup_key: lookup,
    });
    console.log(`Created ${plan.name} at $${plan.usd}/${plan.interval}`);
  } else {
    console.log(`${plan.name} is already set up`);
  }
  env[plan.env] = price.id;
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

// 3. Customer portal: update the card, see invoices, cancel. There is one
// plan, so no plan switching.
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
    subscription_update: { enabled: false },
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
