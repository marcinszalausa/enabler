import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { PACKS, discountPlan, isPackKey, paymentsOpen } from "@/lib/billing";
import { packPrice } from "@/lib/pricing";

// Balances an owner can pick for auto-reload, and the default.
export const RELOAD_THRESHOLDS = [20, 50, 100, 200] as const;
export const MAX_RELOADS_PER_MONTH = 4;

// The card Stripe charges for auto-reload: the customer's default, else the
// subscription's.
export async function savedCard(customer: string) {
  const c = await stripe().customers.retrieve(customer, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (c.deleted) return null;
  const pm = c.invoice_settings?.default_payment_method;
  if (pm && typeof pm !== "string") return pm;
  const subs = await stripe().subscriptions.list({
    customer,
    status: "active",
    limit: 1,
    expand: ["data.default_payment_method"],
  });
  const subPm = subs.data[0]?.default_payment_method;
  return subPm && typeof subPm !== "string" ? subPm : null;
}

// Runs after credits are spent. When the balance is under the owner's
// threshold, charges the saved card for a pack on a one-off Stripe invoice
// (so it shows in Invoices with a PDF). Credits are added by the
// invoice.paid webhook. Any failure turns auto-reload off with the reason.
export async function maybeAutoReload(workspaceId: string) {
  if (!paymentsOpen()) return;
  const admin = createAdminClient();
  const { data: claims, error } = await admin.rpc("claim_auto_reload", {
    ws: workspaceId,
  });
  if (error) {
    console.error("claim_auto_reload failed", error);
    return;
  }
  const claim = (claims as { reload_id: string; pack: string }[] | null)?.[0];
  if (!claim || !isPackKey(claim.pack)) return;

  const fail = async (reason: string) => {
    await admin.rpc("fail_auto_reload", {
      ws: workspaceId,
      reload: claim.reload_id,
      reason,
    });
  };

  let invoiceId: string | null = null;
  try {
    const { data: ws } = await admin
      .from("workspaces")
      .select(
        "plan, stripe_customer_id, stripe_subscription_id, subscription_status",
      )
      .eq("id", workspaceId)
      .single();
    if (!ws?.stripe_customer_id) return await fail("no_card");
    const card = await savedCard(ws.stripe_customer_id);
    if (!card) return await fail("no_card");

    const pack = PACKS[claim.pack];
    const cents = Math.round(packPrice(pack.usd, discountPlan(ws)) * 100);
    const description = `Gooidy credits: ${pack.credits.toLocaleString("en-US")} (auto-reload)`;
    const metadata = {
      workspace_id: workspaceId,
      pack: claim.pack,
      kind: "auto_reload",
      reload_id: claim.reload_id,
    };
    const idem = `auto-reload-${claim.reload_id}`;
    const invoice = await stripe().invoices.create(
      {
        customer: ws.stripe_customer_id,
        collection_method: "charge_automatically",
        auto_advance: false,
        pending_invoice_items_behavior: "exclude",
        currency: "usd",
        description,
        metadata,
        ...(process.env.STRIPE_AUTOMATIC_TAX === "on" && {
          automatic_tax: { enabled: true },
        }),
      },
      { idempotencyKey: `${idem}-invoice` },
    );
    invoiceId = invoice.id!;
    await admin.rpc("note_auto_reload_invoice", {
      reload: claim.reload_id,
      invoice: invoiceId,
    });
    await stripe().invoiceItems.create(
      {
        customer: ws.stripe_customer_id,
        invoice: invoiceId,
        amount: cents,
        currency: "usd",
        description,
      },
      { idempotencyKey: `${idem}-item` },
    );
    await stripe().invoices.finalizeInvoice(invoiceId);
    await stripe().invoices.pay(invoiceId, {
      off_session: true,
      payment_method: card.id,
    });
  } catch (err) {
    console.error("auto-reload failed", workspaceId, err);
    const code =
      (err as Stripe.errors.StripeError)?.code ??
      (err as Error)?.message ??
      "failed";
    if (invoiceId) {
      await stripe()
        .invoices.voidInvoice(invoiceId)
        .catch(() => undefined);
    }
    await fail(code);
  }
}

// invoice.paid for an auto-reload invoice: adds the pack's credits.
export async function handleAutoReloadPaid(invoice: Stripe.Invoice) {
  const meta = invoice.metadata;
  if (meta?.kind !== "auto_reload" || !invoice.id) return false;
  const pack = meta.pack;
  const ws = meta.workspace_id;
  if (!isPackKey(pack) || !ws) return true;
  const { error } = await createAdminClient().rpc("complete_auto_reload", {
    ws,
    invoice: invoice.id,
    amount: PACKS[pack].credits,
  });
  if (error) throw error;
  return true;
}

// invoice.payment_failed for an auto-reload invoice (e.g. the bank asked
// for confirmation later and it failed).
export async function handleAutoReloadFailed(invoice: Stripe.Invoice) {
  const meta = invoice.metadata;
  if (meta?.kind !== "auto_reload" || !meta.workspace_id) return;
  await createAdminClient().rpc("fail_auto_reload", {
    ws: meta.workspace_id,
    reload: meta.reload_id ?? null,
    reason: "card_declined",
  });
}

// A finished card-saving Checkout from "Turn on" auto-reload: makes the card
// the customer's default and turns auto-reload on with the chosen settings.
export async function handleAutoReloadSetup(session: Stripe.Checkout.Session) {
  const meta = session.metadata;
  if (session.mode !== "setup" || meta?.kind !== "auto_reload") return;
  const ws = meta.workspace_id;
  const threshold = Number(meta.threshold);
  if (!ws || !isPackKey(meta.pack) || !Number.isInteger(threshold)) return;
  const setup = session.setup_intent;
  const intent =
    typeof setup === "string"
      ? await stripe().setupIntents.retrieve(setup)
      : setup;
  const pm = intent?.payment_method;
  const customer =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!pm || !customer) return;
  await stripe().customers.update(customer, {
    invoice_settings: {
      default_payment_method: typeof pm === "string" ? pm : pm.id,
    },
  });
  const { error } = await createAdminClient()
    .from("workspaces")
    .update({
      auto_reload_enabled: true,
      auto_reload_threshold: threshold,
      auto_reload_pack: meta.pack,
      auto_reload_error: null,
    })
    .eq("id", ws);
  if (error) throw error;
  await maybeAutoReload(ws);
}
