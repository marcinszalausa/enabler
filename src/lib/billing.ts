import "server-only";

// Paid plans. Prices live in Stripe (one monthly price per plan, its id in
// the env var); credits are granted here each time an invoice is paid.
export const PLANS = {
  starter: {
    name: "Starter",
    price: "$29 / month",
    credits: 300,
    priceEnv: "STRIPE_PRICE_STARTER",
  },
  growth: {
    name: "Growth",
    price: "$79 / month",
    credits: 1000,
    priceEnv: "STRIPE_PRICE_GROWTH",
  },
} as const;
export type PlanKey = keyof typeof PLANS;

export const FREE_PLAN = { name: "Free", credits: 100 } as const;

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && value in PLANS;
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

export function planName(plan: string): string {
  return isPlanKey(plan) ? PLANS[plan].name : FREE_PLAN.name;
}
