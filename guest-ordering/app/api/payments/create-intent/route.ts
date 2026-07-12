import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { computeOrderCharge, type PricingItemInput } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import type { OrderMeta } from "@/lib/createOrder";

interface OrderPayload extends OrderMeta {
  items: PricingItemInput[];
}

// Stripe's minimum chargeable amount (USD). Our pricing is whole-dollar
// ($1 Giant, $3 surcharge), so a >0 total is always >= $1 — this guard just
// makes the impossible-sub-minimum case fail loudly instead of at Stripe.
const STRIPE_MIN_CENTS = 50;

/**
 * Creates a Stripe PaymentIntent for an order that has a real charge. The
 * amount is computed 100% server-side (computeOrderCharge) — the client never
 * sends money figures. A $0 order returns { noPaymentRequired: true } and the
 * client falls back to the free /api/orders path.
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  let body: { order?: OrderPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const order = body.order;
  if (!order?.id || !Array.isArray(order.items) || order.items.length === 0) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
  }

  const pricing = await computeOrderCharge(order.items, order.guestId ?? null);
  if (!pricing.ok) {
    return NextResponse.json(
      { error: pricing.error, ...(pricing.cooldownMs != null ? { cooldownMs: pricing.cooldownMs } : {}) },
      { status: pricing.status },
    );
  }

  // Free order — no payment needed; client uses the existing free path.
  if (pricing.totalCents === 0) {
    return NextResponse.json({ noPaymentRequired: true });
  }
  if (pricing.totalCents < STRIPE_MIN_CENTS) {
    return NextResponse.json({ error: "Order total is below the minimum card charge." }, { status: 400 });
  }

  // Everything createOrder will need later, stored server-side so the webhook
  // can finalize the order even if the client is interrupted after paying.
  const meta: OrderMeta = {
    id: order.id, locationId: order.locationId, locationName: order.locationName,
    section: order.section, floor: order.floor, estimatedMinutes: order.estimatedMinutes,
    placedAt: order.placedAt, status: order.status,
    ageBracket: order.ageBracket ?? null, ageVerifiedAt: order.ageVerifiedAt ?? null,
    guestId: order.guestId ?? null, guestName: order.guestName ?? null,
  };
  const pendingPayload = {
    meta,
    rows: pricing.rows,
    surchargeAmount: pricing.surchargeAmount,
    surchargeLabel: pricing.surchargeLabel,
  };

  let clientSecret: string | null = null;
  let paymentIntentId: string;
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount:   pricing.totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true }, // surfaces Apple/Google Pay automatically
      metadata: { order_id: order.id },
      description: `POUR order ${order.id}`,
    });
    clientSecret = intent.client_secret;
    paymentIntentId = intent.id;
  } catch (err) {
    console.error("Stripe PaymentIntent create failed:", err);
    return NextResponse.json({ error: "Could not start payment." }, { status: 502 });
  }

  // Persist the pending order keyed to this PaymentIntent (SECURITY DEFINER RPC).
  const { error: pendErr } = await supabase.rpc("create_pending_order", {
    p_id:                order.id,
    p_payment_intent_id: paymentIntentId,
    p_payload:           pendingPayload,
    p_amount_cents:      pricing.totalCents,
  });
  if (pendErr) {
    console.error("Failed to persist pending order:", pendErr.message);
    return NextResponse.json({ error: "Could not start payment." }, { status: 500 });
  }

  return NextResponse.json({
    clientSecret,
    amountCents: pricing.totalCents,
    surchargeAmount: pricing.surchargeAmount,
    surchargeLabel: pricing.surchargeLabel,
  });
}
