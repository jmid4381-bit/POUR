"use client";

/**
 * lib/stripeClient.ts — browser-side Stripe.js loader.
 *
 * Uses ONLY the publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY). Loaded
 * once and memoized. Returns a promise of null when the key isn't configured,
 * so the app degrades gracefully instead of crashing.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
