import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  handleInvoicePaid,
  handlePackCheckout,
  syncSubscription,
} from "@/lib/subscriptions";

// Stripe calls this for subscription, invoice and checkout events. The
// signature check proves the request came from Stripe, so it can't be used
// to grant credits.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch (err) {
    console.error("stripe webhook signature failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: seen } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handlePackCheckout(event.data.object);
        break;
    }
  } catch (err) {
    // A 500 makes Stripe retry the event later.
    console.error("stripe webhook failed", event.type, event.id, err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  // Recorded after handling, so a failed attempt is retried in full.
  await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  return Response.json({ received: true });
}
