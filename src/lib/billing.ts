import "server-only";
import { PACK_PRICES, type Interval } from "@/lib/pricing";
import { PAID_PLANS, type PaidPlanId } from "@/lib/paid-plans";
import { PAID_CHECKOUT_STATUS } from "@/lib/legal-policy";

// Whether customers can pay online now: Stripe is set up, and live payments
// are allowed (src/lib/legal-policy.ts). Stripe test mode always works, for
// testing.
export function paymentsOpen() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  return PAID_CHECKOUT_STATUS !== "unavailable" || key.startsWith("sk_test_");
}

// Paid plans: Starter, Plus and Growth, with prices and monthly credits from
// the public catalogue (src/lib/paid-plans.ts). Stripe holds a monthly and a
// yearly USD price per plan, their ids in env vars; credits are granted here
// each month, with unused plan credits carried over for one more month.
const PLAN_DETAILS = Object.fromEntries(
  PAID_PLANS.map((plan) => [
    plan.id,
    {
      name: plan.name,
      usd: plan.price,
      credits: plan.credits,
      priceEnv: {
        month: `STRIPE_PRICE_${plan.id.toUpperCase()}`,
        year: `STRIPE_PRICE_${plan.id.toUpperCase()}_YEARLY`,
      },
    },
  ]),
) as Record<
  PaidPlanId,
  {
    name: string;
    usd: number;
    credits: number;
    priceEnv: Record<Interval, string>;
  }
>;
export const PLANS = PLAN_DETAILS;
export type PlanKey = PaidPlanId;

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
