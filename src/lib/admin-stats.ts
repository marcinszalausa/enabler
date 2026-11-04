// Numbers for the admin dashboard, worked out from plain rows so they can be
// tested without a database. Nothing here decides access.
import { PAID_PLANS } from "./paid-plans.ts";

// Real provider cost is not logged per run yet (generations.cost_usd is
// empty), so AI cost is estimated from credits. $0.05 per credit is the
// worst case from the 2026-11-04 margin review, after PR #59.
export const USD_PER_CREDIT_ESTIMATE = 0.05;

export type AdminUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null };
export type AdminWorkspace = { id: string; name: string; owner_id: string; plan: string; credits: number; created_at: string };
export type AdminGeneration = {
  id: string; workspace_id: string; product_id: string | null; type: string; status: string;
  cost_credits: number; cost_usd: number | string | null; request_options: unknown; created_at: string;
  model?: string | null; error?: string | null;
};
export type AdminPost = { id: string; workspace_id: string; status: string; created_at: string };
export type AdminAccount = { id: string; workspace_id: string; platform: string };
export type AdminProduct = { id: string; workspace_id: string };
export type CreditTotal = { workspace_id: string; charged: number; refunded: number };

export type AdminData = {
  users: AdminUser[]; workspaces: AdminWorkspace[]; generations: AdminGeneration[];
  posts: AdminPost[]; accounts: AdminAccount[]; products: AdminProduct[];
  credits: CreditTotal[]; credits30: CreditTotal[];
};

const DAY = 86_400_000;

export function planLabel(plan: string | null | undefined) {
  if (!plan || plan === "free") return "Free";
  return PAID_PLANS.find((p) => p.id === plan)?.name ?? plan;
}

export function planPrice(plan: string | null | undefined) {
  return PAID_PLANS.find((p) => p.id === plan)?.price ?? 0;
}

export function runKind(type: string) {
  return type === "video_ads" ? "Video" : type === "image_ads" ? "Images" : type;
}

export function runQuality(options: unknown) {
  const q = options && typeof options === "object" && "quality" in options ? (options as { quality: unknown }).quality : null;
  return q === "good" || q === "better" || q === "best" ? q : "not set";
}

// Credits a workspace really spent: charges minus refunds of failed runs.
export function netCredits(total: CreditTotal | undefined) {
  return total ? Math.max(0, Number(total.charged) - Number(total.refunded)) : 0;
}

export function estimatedCost(credits: number) {
  return credits * USD_PER_CREDIT_ESTIMATE;
}

export type CustomerRow = {
  workspaceId: string; email: string; name: string; plan: string; creditsLeft: number;
  creditsUsed: number; runs: number; failedRuns: number; products: number; posts: number;
  accounts: number; signedUp: string; lastSignIn: string | null; lastRun: string | null;
};

function countBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + 1);
  return map;
}

export function customerRows(data: AdminData): CustomerRow[] {
  const users = new Map(data.users.map((u) => [u.id, u]));
  const credits = new Map(data.credits.map((c) => [c.workspace_id, c]));
  const products = countBy(data.products, (p) => p.workspace_id);
  const posts = countBy(data.posts.filter((p) => p.status === "published" || p.status === "partial"), (p) => p.workspace_id);
  const accounts = countBy(data.accounts, (a) => a.workspace_id);
  const runs = new Map<string, { runs: number; failed: number; last: string | null }>();
  for (const g of data.generations) {
    const r = runs.get(g.workspace_id) ?? { runs: 0, failed: 0, last: null };
    r.runs++;
    if (g.status === "failed") r.failed++;
    if (!r.last || g.created_at > r.last) r.last = g.created_at;
    runs.set(g.workspace_id, r);
  }
  return data.workspaces
    .map((w) => {
      const owner = users.get(w.owner_id);
      const r = runs.get(w.id);
      return {
        workspaceId: w.id,
        email: owner?.email ?? "(deleted user)",
        name: w.name,
        plan: w.plan,
        creditsLeft: w.credits,
        creditsUsed: netCredits(credits.get(w.id)),
        runs: r?.runs ?? 0,
        failedRuns: r?.failed ?? 0,
        products: products.get(w.id) ?? 0,
        posts: posts.get(w.id) ?? 0,
        accounts: accounts.get(w.id) ?? 0,
        signedUp: owner?.created_at ?? w.created_at,
        lastSignIn: owner?.last_sign_in_at ?? null,
        lastRun: r?.last ?? null,
      };
    })
    .sort((a, b) => b.signedUp.localeCompare(a.signedUp));
}

export function searchCustomers(rows: CustomerRow[], query: string, plan: string) {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!plan || (plan === "paid" ? r.plan !== "free" : r.plan === plan)) &&
      (!q || r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.workspaceId.startsWith(q)),
  );
}

export type Overview = ReturnType<typeof overview>;

export function overview(data: AdminData, now = Date.now()) {
  const since7 = now - 7 * DAY;
  const since30 = now - 30 * DAY;
  const time = (s: string) => Date.parse(s);
  const signups = data.users.map((u) => time(u.created_at));
  const paid = data.workspaces.filter((w) => planPrice(w.plan) > 0);
  const creditsAll = data.credits.reduce((s, c) => s + netCredits(c), 0);
  const credits30 = data.credits30.reduce((s, c) => s + netCredits(c), 0);
  const runs30 = data.generations.filter((g) => time(g.created_at) >= since30);
  const realCost30 = runs30.reduce((s, g) => s + (g.cost_usd == null ? 0 : Number(g.cost_usd)), 0);
  const published = data.posts.filter((p) => p.status === "published" || p.status === "partial");

  const plans = ["free", ...PAID_PLANS.map((p) => p.id)].map((id) => ({
    id,
    label: planLabel(id),
    customers: data.workspaces.filter((w) => (w.plan || "free") === id).length,
    price: planPrice(id),
  }));

  // Runs by kind and quality, all time, with success rate and credits.
  const mix = new Map<string, { kind: string; quality: string; runs: number; failed: number; credits: number }>();
  for (const g of data.generations) {
    const kind = runKind(g.type);
    const quality = runQuality(g.request_options);
    const key = kind + "|" + quality;
    const row = mix.get(key) ?? { kind, quality, runs: 0, failed: 0, credits: 0 };
    row.runs++;
    if (g.status === "failed") row.failed++;
    else row.credits += g.cost_credits;
    mix.set(key, row);
  }

  const platforms = [...countBy(data.accounts, (a) => a.platform)].map(([platform, count]) => ({ platform, count })).sort((a, b) => b.count - a.count);

  return {
    customers: data.workspaces.length,
    new7: signups.filter((t) => t >= since7).length,
    new30: signups.filter((t) => t >= since30).length,
    active30: new Set(runs30.map((g) => g.workspace_id)).size,
    paying: paid.length,
    monthlyPlanValue: paid.reduce((s, w) => s + planPrice(w.plan), 0),
    creditsAll,
    credits30,
    estCost30: estimatedCost(credits30),
    realCost30,
    estCostAll: estimatedCost(creditsAll),
    runs30: runs30.length,
    failed30: runs30.filter((g) => g.status === "failed").length,
    running: data.generations.filter((g) => g.status === "queued" || g.status === "running").length,
    products: data.products.length,
    published: published.length,
    published30: published.filter((p) => time(p.created_at) >= since30).length,
    failedPosts: data.posts.filter((p) => p.status === "failed").length,
    accounts: data.accounts.length,
    platforms,
    plans,
    mix: [...mix.values()].sort((a, b) => b.runs - a.runs),
    signupsByDay: perDay(signups, now, 30),
    runsByDay: perDay(runs30.map((g) => time(g.created_at)), now, 30),
  };
}

// Counts per UTC day for the last `days` days, oldest first.
export function perDay(times: number[], now: number, days: number) {
  const today = Math.floor(now / DAY);
  const out = Array.from({ length: days }, (_, i) => ({ day: new Date((today - days + 1 + i) * DAY).toISOString().slice(0, 10), count: 0 }));
  for (const t of times) {
    const i = Math.floor(t / DAY) - (today - days + 1);
    if (i >= 0 && i < days) out[i].count++;
  }
  return out;
}
