// Presentation follows durable saved outputs and recorded job states. Time
// elapsed and provider error wording never manufacture a completion percentage.
export type RunSnapshot = {
  type: string;
  status: "queued" | "running" | "succeeded" | "failed";
  cost_credits: number;
  creatives: { kind: "image" | "video" }[];
  video_jobs?: { status: string }[];
};
export type CreditReceipt = { charged_credits: number | null; returned_credits: number | null };
export function generationPresentation(g: RunSnapshot) {
  const video = g.type === "video_ads";
  const total = video ? 2 : 10;
  const saved = g.creatives.filter(c => c.kind === (video ? "video" : "image")).length;
  const active = g.status === "queued" || g.status === "running";
  let phase: "queued" | "preparing" | "creating" | "finishing" | "ready" | "partial" | "failed";
  if (g.status === "queued") phase = "queued";
  else if (!active) phase = g.status === "failed" ? "failed" : saved < total ? "partial" : "ready";
  else if (!video) phase = saved >= total ? "finishing" : "creating";
  else {
    const jobs = g.video_jobs ?? [];
    phase = !jobs.length || jobs.some(j => j.status === "drafting") ? "preparing"
      : jobs.some(j => j.status === "pending") ? "creating" : "finishing";
  }
  return { video, total, saved, active, phase };
}
const amount = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export function settledCredits(g: RunSnapshot, receipt: CreditReceipt | null | undefined) {
  if (g.status === "queued" || g.status === "running" || !receipt) return null;
  const { charged_credits: charged, returned_credits: returned } = receipt;
  if (!amount(returned) || returned > g.cost_credits) return null;
  // Some legacy in-flight runs received refunds but have no charge receipt.
  const used = amount(charged) && returned <= charged ? charged - returned : null;
  return { returned, used };
}
