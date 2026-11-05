import "server-only";
import { createGateway } from "@ai-sdk/gateway";

// Money left on the accounts Gooidy pays for AI and publishing, read live
// from each provider. Anthropic and Google have no balance API, so those link
// to their billing pages instead. Call only after requireAdmin().

export type Balance = {
  name: string;
  use: string;
  state: "ok" | "off" | "error" | "manual";
  value?: string;
  detail?: string;
  link: string;
};

const TIMEOUT = 6000;
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

async function fal(): Promise<Balance> {
  const base = { name: "fal.ai", use: "Images, video fallback, voice", link: "https://fal.ai/dashboard/billing" };
  // A key with billing read access. The generation key works if it has it.
  const key = process.env.FAL_BILLING_KEY?.trim() || process.env.FAL_KEY?.trim();
  if (!key) return { ...base, state: "off", detail: "FAL_KEY is not set." };
  try {
    const res = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
      headers: { authorization: `Key ${key}` }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.status === 401 || res.status === 403)
      return { ...base, state: "error", detail: "This key can't read billing. Add a fal key with billing access as FAL_BILLING_KEY in Vercel." };
    if (!res.ok) return { ...base, state: "error", detail: `fal answered ${res.status}.` };
    const body = (await res.json()) as { credits?: { current_balance?: number; currency?: string } };
    const n = body.credits?.current_balance;
    if (typeof n !== "number") return { ...base, state: "error", detail: "fal didn't return a balance." };
    return { ...base, state: "ok", value: money(n), detail: n < 20 ? "Low. Top up or turn on auto top-up so runs don't stop." : "fal's number can lag up to an hour." };
  } catch {
    return { ...base, state: "error", detail: "Couldn't reach fal." };
  }
}

async function gateway(): Promise<Balance> {
  const base = { name: "Vercel AI Gateway", use: "Seedance video (Better, Best)", link: "https://vercel.com/dashboard/ai-gateway" };
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) return { ...base, state: "off", detail: "AI_GATEWAY_API_KEY is not set, so fal makes these videos." };
  try {
    const credits = await Promise.race([
      createGateway({ apiKey: key }).getCredits(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT)),
    ]);
    const n = Number(credits.balance);
    return { ...base, state: "ok", value: money(n), detail: `${money(Number(credits.totalUsed))} used so far.` };
  } catch {
    return { ...base, state: "error", detail: "Couldn't read the AI Gateway balance." };
  }
}

async function zernio(): Promise<Balance> {
  const base = { name: "Zernio", use: "Social publishing", link: "https://zernio.com/dashboard" };
  const key = process.env.ZERNIO_API_KEY?.trim();
  if (!key) return { ...base, state: "off", detail: "ZERNIO_API_KEY is not set." };
  try {
    const res = await fetch("https://zernio.com/api/v1/billing", {
      headers: { authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return { ...base, state: "error", detail: `Zernio answered ${res.status}.` };
    const body = (await res.json()) as { plan?: { name?: string }; balance?: Record<string, unknown> | null; status?: { suspended?: boolean; openInvoiceUrl?: string | null } };
    if (body.status?.suspended) return { ...base, state: "error", value: body.plan?.name, detail: "Your Zernio account is suspended, so posts will fail." };
    return { ...base, state: "ok", value: body.plan?.name ?? "Connected", detail: describeZernioBalance(body.balance) };
  } catch {
    return { ...base, state: "error", detail: "Couldn't reach Zernio." };
  }
}

// Zernio doesn't document the balance fields; amounts in cents are shown as
// dollars, everything else as it comes.
export function describeZernioBalance(balance: Record<string, unknown> | null | undefined) {
  if (!balance) return "Fixed monthly plan.";
  const parts = Object.entries(balance)
    .filter(([, v]) => typeof v === "number")
    .slice(0, 3)
    .map(([k, v]) => {
      const label = k.replace(/Cents$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
      return k.endsWith("Cents") ? `${label}: ${money((v as number) / 100)}` : `${label}: ${(v as number).toLocaleString("en-US")}`;
    });
  return parts.length ? parts.join(" · ") : "Usage-based plan.";
}

export async function providerBalances(): Promise<Balance[]> {
  const live = await Promise.all([fal(), gateway(), zernio()]);
  return [
    ...live,
    { name: "Anthropic", use: "Ad copy and image checks (Claude)", state: "manual", detail: "No balance API. Check it on the billing page.", link: "https://console.anthropic.com/settings/billing" },
    { name: "Google AI Studio", use: "Nano Banana images (Better, Best)", state: "manual", detail: "No balance API. Check it on the billing page.", link: "https://aistudio.google.com/usage" },
  ];
}
