import type { Messages } from "@/i18n/messages";
import { PAID_PLANS, type PaidPlanId } from "@/lib/paid-plans";

// Prices in US dollars, shared by the pricing table and billing. Stripe's
// Adaptive Pricing shows each buyer the amount in their own currency at
// checkout, and payouts stay in dollars.
export const PLAN_PRICES = {
  free: 0,
  ...Object.fromEntries(PAID_PLANS.map((plan) => [plan.id, plan.price])),
} as Record<"free" | PaidPlanId, number>;
// Paying for a year at once costs this much less than twelve months.
export const YEARLY_DISCOUNT = 0.2;
export const PACK_PRICES = { small: 35, large: 95 } as const;
export const PACK_CREDITS = { small: 300, large: 1000 } as const;
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

// A plan's name: the free plan's as the pricing table shows it in the page's
// language; paid plans keep their product names (Starter, Plus, Growth).
export function planName(t: Messages, plan: string | null | undefined) {
  const paid = PAID_PLANS.find((p) => p.id === plan);
  return paid ? paid.name : (t.home.plans[0]?.name ?? "Free");
}
