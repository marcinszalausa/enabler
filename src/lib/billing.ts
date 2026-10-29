import "server-only";
import { PACK_PRICES, PLAN_PRICES } from "@/lib/pricing";

// Paid plans. Prices live in Stripe (one monthly USD price per plan, its id
// in the env var); credits are granted here each time an invoice is paid.
export const PLANS = {
  starter: {
    name: "Starter",
    usd: PLAN_PRICES.starter,
    credits: 300,
    priceEnv: "STRIPE_PRICE_STARTER",
  },
  plus: {
    name: "Plus",
    usd: PLAN_PRICES.plus,
    credits: 600,
    priceEnv: "STRIPE_PRICE_PLUS",
  },
  growth: {
    name: "Growth",
    usd: PLAN_PRICES.growth,
    credits: 1000,
    priceEnv: "STRIPE_PRICE_GROWTH",
  },
} as const;
export type PlanKey = keyof typeof PLANS;

// One-time credit packs. Charged in USD with an inline price, so they need
// no setup in Stripe. Unlike subscriptions abroad, one-time payments can use
// local methods such as BLIK, iDEAL, PayPal or Pix.
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

export function priceIdFor(plan: PlanKey): string | undefined {
  return process.env[PLANS[plan].priceEnv];
}

export function planForPrice(priceId: string): PlanKey | null {
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    if (priceIdFor(key) === priceId) return key;
  }
  return null;
}
