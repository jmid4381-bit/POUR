import { NextRequest, NextResponse } from "next/server";
import { computeOrderCharge, type PricingItemInput } from "@/lib/pricing";
import { createOrder, type OrderMeta } from "@/lib/createOrder";
import { isStripeConfigured } from "@/lib/stripe";
import { logError } from "@/lib/logger";
import { createRateLimiter, clientIp, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

// Best-effort: resets on cold start and isn't shared across regions/instances.
// Sufficient to deter a casual script flooding a single QR location.
const isRateLimited = createRateLimiter(60_000, 5);

interface OrderPayload extends OrderMeta {
  items: PricingItemInput[];
}

/**
 * FREE order path only. An order whose server-computed total is > $0 (a Giant
 * or the active surcharge) must go through the Stripe payment flow instead —
 * this route rejects those with 402 so a client can't skip payment by posting
 * straight here. $0 orders (the common case) are created immediately.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
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

  const pricing = await computeOrderCharge(order.items, order.guestId ?? null, order.locationId);
  if (!pricing.ok) {
    return NextResponse.json(
      { error: pricing.error, ...(pricing.cooldownMs != null ? { cooldownMs: pricing.cooldownMs } : {}) },
      { status: pricing.status },
    );
  }

  // Anything with a real charge must be paid via Stripe, not created here —
  // BUT only when Stripe is actually configured. Until keys are set, this
  // stays the pay-at-table free flow it's always been, so deploying the
  // payment code can't block Giant/surcharge orders before Stripe is live.
  if (pricing.totalCents > 0 && isStripeConfigured()) {
    return NextResponse.json(
      { error: "This order requires payment.", paymentRequired: true, amountCents: pricing.totalCents },
      { status: 402 },
    );
  }

  const result = await createOrder(order, pricing.rows, pricing.surchargeAmount, pricing.surchargeLabel);
  if (!result.ok) {
    // submit_order's own guest-scoped rate limit (2026-07-15 audit) — this is
    // the RPC-level guard that can't be bypassed by calling Supabase directly,
    // unlike the IP-based check above. Same friendly 429 shape as that check
    // so the client's existing handling (lib/queue.ts) covers both.
    if (result.error.includes("RATE_LIMITED")) {
      return NextResponse.json(
        { error: "Too many orders placed too quickly. Please wait a moment." },
        { status: 429 },
      );
    }
    // This is the real order-write failure path — previously discarded the
    // actual Postgres error (result.error) entirely, so a failed order left
    // zero trace anywhere. Now logged with enough context to investigate.
    logError("Order creation failed", new Error(result.error), {
      orderId: order.id,
      locationId: order.locationId,
      guestId: order.guestId ?? null,
    });
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    surchargeAmount: pricing.surchargeAmount,
    surchargeLabel: pricing.surchargeLabel,
  });
}
