"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { isPlanKey, priceIdFor } from "@/lib/billing";
import { UserError, userMessage } from "@/lib/errors";

export type BillingState = { error: string | null };

// Billing changes are for the workspace owner only.
async function ownerWorkspace() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, stripe_customer_id, stripe_subscription_id")
    .order("created_at")
    .limit(1)
    .single();
  if (!ws) throw new UserError("No workspace found.");

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", auth.user.id)
    .single();
  if (member?.role !== "owner") {
    throw new UserError("Only the workspace owner can change billing.");
  }
  return { ws, email: auth.user.email };
}

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

// Returns the workspace's Stripe customer, creating it on first use.
async function customerFor(
  ws: {
    id: string;
    name: string;
    stripe_customer_id: string | null;
  },
  email: string | undefined,
) {
  if (ws.stripe_customer_id) return ws.stripe_customer_id;

  const customer = await stripe().customers.create({
    email,
    name: ws.name,
    metadata: { workspace_id: ws.id },
  });
  const admin = createAdminClient();
  // Only fill an empty slot, so two quick clicks can't link two customers.
  await admin
    .from("workspaces")
    .update({ stripe_customer_id: customer.id })
    .eq("id", ws.id)
    .is("stripe_customer_id", null);
  const { data } = await admin
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", ws.id)
    .single();
  return (data?.stripe_customer_id as string) ?? customer.id;
}

export async function startCheckout(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  let url: string | null = null;
  try {
    const plan = formData.get("plan");
    if (!isPlanKey(plan)) return { error: "Pick a plan." };
    const price = priceIdFor(plan);
    if (!price) throw new UserError("This plan isn't set up yet.");

    const { ws, email } = await ownerWorkspace();
    // Already subscribed: plan changes happen in the billing portal.
    if (!ws.stripe_subscription_id) {
      const origin = await siteOrigin();
      const session = await stripe().checkout.sessions.create({
        mode: "subscription",
        customer: await customerFor(ws, email),
        line_items: [{ price, quantity: 1 }],
        client_reference_id: ws.id,
        subscription_data: { metadata: { workspace_id: ws.id } },
        allow_promotion_codes: true,
        success_url: `${origin}/dashboard/billing?checkout=success`,
        cancel_url: `${origin}/dashboard/billing`,
      });
      if (!session.url) throw new Error("Checkout session has no URL");
      url = session.url;
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error("startCheckout failed", err);
    return {
      error: userMessage(err, "Couldn't open checkout. Please try again."),
    };
  }
  // redirect() throws, so it stays outside the try above.
  if (!url) return openPortal();
  redirect(url);
}

export async function openPortal(): Promise<BillingState> {
  let url: string;
  try {
    const { ws, email } = await ownerWorkspace();
    const session = await stripe().billingPortal.sessions.create({
      customer: await customerFor(ws, email),
      return_url: `${await siteOrigin()}/dashboard/billing`,
    });
    url = session.url;
  } catch (err) {
    unstable_rethrow(err);
    console.error("openPortal failed", err);
    return {
      error: userMessage(err, "Couldn't open billing. Please try again."),
    };
  }
  redirect(url);
}
