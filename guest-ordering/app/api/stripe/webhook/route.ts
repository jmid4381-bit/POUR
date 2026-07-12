import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { finalizePaidOrder } from "@/lib/finalizeOrder";
import { supabase } from "@/lib/supabase";

// Stripe signs the raw request body — it must be read verbatim, so this route
// runs on the Node runtime and reads req.text() (never a parsed body).
export const runtime = "nodejs";

/**
 * Stripe webhook — the source of truth for payment outcomes. Even if the
 * client's confirmation flow is interrupted after paying, this still creates
 * the order (idempotently). Signature-verified with STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const result = await finalizePaidOrder(pi.id);
        if (!result.ok) {
          // Logged, but still return 200 — retrying the webhook won't help a
          // fulfillment that was already refunded, and Stripe would keep
          // redelivering on a non-2xx.
          console.error("Webhook could not finalize order for", pi.id, result.error);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await supabase.rpc("mark_pending_order", { p_payment_intent_id: pi.id, p_status: "failed" });
        break;
      }
      default:
        // Other event types are acknowledged and ignored.
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Still 200 — see note above; we don't want infinite Stripe retries on a
    // transient handler issue that redelivery won't fix.
  }

  return NextResponse.json({ received: true });
}
