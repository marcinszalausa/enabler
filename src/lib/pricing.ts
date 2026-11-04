import type { Messages } from "@/i18n/messages";

// Prices in US dollars, shared by the pricing table and billing. Stripe's
// Adaptive Pricing shows each buyer the amount in their own currency at
// checkout, and payouts stay in dollars.
export const PLAN_PRICES = { free: 0, starter: 39, growth: 99 } as const;
// Paying for a year at once costs this much less than twelve months.
export const YEARLY_DISCOUNT = 0.2;
export const PACK_PRICES = { small: 35, large: 95 } as const;
// The first payment for a plan can be refunded in full within this many days.
export const MONEY_BACK_DAYS = 30;

export type Interval = "month" | "year";

// A plan's yearly price, e.g. $39 a month is $374.40 a year.
export function yearlyPrice(monthly: number) {
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100;
}

// "$29" (or "$31.20") in any language's number format.
export function usd(amount: number, locale = "en") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: amount % 1 ? 2 : 0,
  }).format(amount);
}

// Plans in pricing-table order: Free, Starter, Growth.
export const PLAN_KEYS = Object.keys(PLAN_PRICES);

// A plan's name as the pricing table shows it, in the page's language.
export function planName(t: Messages, plan: string | null | undefined) {
  const i = PLAN_KEYS.indexOf(plan ?? "free");
  return t.home.plans[i]?.name ?? plan ?? "";
}
