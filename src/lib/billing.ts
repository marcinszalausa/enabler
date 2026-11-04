import "server-only";
import { PACK_PRICES, PLAN_PRICES, type Interval } from "@/lib/pricing";

// Paid plans. Prices live in Stripe (a monthly and a yearly USD price per
// plan, their ids in env vars); credits are granted here: each month, with
// unused plan credits carried over for one more month.
export const PLANS = {
  starter: {
    name: "Starter",
    usd: PLAN_PRICES.starter,
    credits: 300,
    priceEnv: {
      month: "STRIPE_PRICE_STARTER",
      year: "STRIPE_PRICE_STARTER_YEARLY",
    },
  },
  growth: {
    name: "Growth",
    usd: PLAN_PRICES.growth,
    credits: 1000,
    priceEnv: {
      month: "STRIPE_PRICE_GROWTH",
      year: "STRIPE_PRICE_GROWTH_YEARLY",
    },
  },
} as const;
export type PlanKey = keyof typeof PLANS;

// One-time credit packs. Charged in USD with an inline price, so they need
// no setup in Stripe. Unlike subscriptions abroad, one-time payments can use
// local methods such as BLIK, iDEAL, PayPal or Pix. Pack credits never
// expire.
export const PACKS = {
  small: { credits: 300, usd: PACK_PRICES.small },
  large: { credits: 1000, usd: PACK_PRICES.large },
} as const;
export type PackKey = keyof typeof PACKS;

export const FREE_PLAN = { name: "Free", credits: 100 } as const;

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && value in PLANS;
}

export function isPackKey(value: unknown): value is PackKey {
  return typeof value === "string" && value in PACKS;
}

export function isInterval(value: unknown): value is Interval {
  return value === "month" || value === "year";
}

export function priceIdFor(
  plan: PlanKey,
  interval: Interval,
): string | undefined {
  return process.env[PLANS[plan].priceEnv[interval]];
}

export function planForPrice(
  priceId: string,
): { plan: PlanKey; interval: Interval } | null {
  for (const plan of Object.keys(PLANS) as PlanKey[]) {
    for (const interval of ["month", "year"] as const) {
      if (priceIdFor(plan, interval) === priceId) return { plan, interval };
    }
  }
  return null;
}
