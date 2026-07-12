/**
 * lib/stripe.ts — server-only Stripe client.
 *
 * NEVER import this from client components. It reads STRIPE_SECRET_KEY, which
 * must never reach the browser. The publishable key (NEXT_PUBLIC_...) is the
 * only Stripe key the client ever sees, loaded separately in the payment sheet.
 *
 * Lazily constructed so the module can be imported during a build that doesn't
 * have the key set (e.g. CI type-check) without throwing at import time — it
 * only throws if a payment route actually tries to use it without a key.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set — payment routes require it.");
  }
  _stripe = new Stripe(key);
  return _stripe;
}

// True when Stripe is configured for this deployment. Payment routes short-
// circuit to a clear 503 rather than a cryptic crash when it isn't.
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
