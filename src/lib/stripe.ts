import "server-only";
import Stripe from "stripe";
import { UserError } from "@/lib/errors";

let client: Stripe | undefined;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new UserError("Billing isn't set up yet. Add STRIPE_SECRET_KEY.");
    }
    client = new Stripe(key);
  }
  return client;
}
