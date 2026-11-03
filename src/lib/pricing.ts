import type { Messages } from "@/i18n/messages";

// Prices in US dollars, shared by the pricing table and billing. Stripe's
// Adaptive Pricing shows each buyer the amount in their own currency at
// checkout, and payouts stay in dollars.
export const PLAN_PRICES = { free: 0, pro: 79 } as const;
// A first Pro subscription: this much for this many days, then the monthly
// price.
export const PRO_INTRO = { usd: 29, days: 28 } as const;
export const BOOST_PRICE = 39;
export const PACK_PRICES = { small: 35, large: 95 } as const;

// "$29" in any language's number format.
export function usd(amount: number, locale = "en") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: amount % 1 ? 2 : 0,
  }).format(amount);
}

// Plans in pricing-table order: Free, Pro.
export const PLAN_KEYS = Object.keys(PLAN_PRICES);

// A plan's name as the pricing table shows it, in the page's language.
export function planName(t: Messages, plan: string | null | undefined) {
  const i = PLAN_KEYS.indexOf(plan ?? "free");
  return t.home.plans[i]?.name ?? plan ?? "";
}
