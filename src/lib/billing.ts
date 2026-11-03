import "server-only";
import {
  BOOST_PRICE,
  PACK_PRICES,
  PLAN_PRICES,
  PRO_INTRO,
} from "@/lib/pricing";

// Paid plans. Prices live in Stripe (one monthly USD price per plan, its id
// in the env var); credits are granted here each time an invoice is paid.
// A first subscription starts with a cheaper intro period, like Zeely's.
export const PLANS = {
  pro: {
    name: "Pro",
    usd: PLAN_PRICES.pro,
    credits: 1000,
    intro: PRO_INTRO,
    priceEnv: "STRIPE_PRICE_PRO",
  },
} as const;
export type PlanKey = keyof typeof PLANS;

// A yearly add-on to a paid plan: extra credits every month on top of the
// plan's. Its own subscription, since Stripe can't mix yearly and monthly
// prices in one.
export const BOOST = {
  usd: BOOST_PRICE,
  monthlyCredits: 300,
  priceEnv: "STRIPE_PRICE_BOOST",
} as const;

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

export function boostPriceId(): string | undefined {
  return process.env[BOOST.priceEnv];
}

export function planForPrice(priceId: string): PlanKey | null {
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    if (priceIdFor(key) === priceId) return key;
  }
  return null;
}
