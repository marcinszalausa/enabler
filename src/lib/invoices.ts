import "server-only";
import { stripe } from "@/lib/stripe";

export type InvoiceRow = {
  id: string;
  created: number; // seconds
  total: number; // in the smallest unit of `currency`
  currency: string;
  status: string; // paid, open, void, uncollectible
  pdf: string | null;
};

// The customer's Stripe invoices, newest first: plan payments, credit packs
// and auto-reloads. Drafts are left out. Empty when Stripe isn't set up.
export async function listInvoices(
  customer: string | null,
): Promise<InvoiceRow[]> {
  if (!customer || !process.env.STRIPE_SECRET_KEY) return [];
  try {
    const page = await stripe().invoices.list({ customer, limit: 24 });
    return page.data
      .filter((invoice) => invoice.status && invoice.status !== "draft")
      .map((invoice) => ({
        id: invoice.id ?? "",
        created: invoice.created,
        total: invoice.status === "paid" ? invoice.amount_paid : invoice.total,
        currency: invoice.currency,
        status: invoice.status ?? "open",
        pdf: invoice.invoice_pdf ?? null,
      }));
  } catch (err) {
    console.error("listInvoices failed", err);
    return [];
  }
}

// "$21.32" (or "21,32 zł") from Stripe's smallest-unit amount.
export function formatAmount(amount: number, currency: string, locale: string) {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 10 ** digits);
}
