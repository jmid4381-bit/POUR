import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { finalizePaidOrder } from "@/lib/finalizeOrder";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

// Same defense-in-depth as create-intent — a valid paymentIntentId already
// bounds abuse somewhat (it has to come from a rate-limited create-intent
// call), but this route still hits Stripe's retrieve() API on every call
// with no cap of its own otherwise.
const isRateLimited = createRateLimiter(60_000, 5);

/**
 * Client calls this right after stripe.confirmPayment resolves, for instant
 * order confirmation. We re-verify the PaymentIntent status with Stripe here
 * (server-side) before creating the order, so a client can't finalize a
 * PaymentIntent that isn't actually paid. The webhook is the backstop if this
 * call never happens (e.g. the guest closed the tab); both are idempotent.
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: { paymentIntentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const paymentIntentId = body.paymentIntentId;
  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing paymentIntentId" }, { status: 400 });
  }

  // Authoritative payment check — never trust the client's word that it paid.
  let paid = false;
  try {
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    paid = intent.status === "succeeded";
  } catch (err) {
    console.error("Failed to retrieve PaymentIntent:", err);
    return NextResponse.json({ error: "Could not verify payment." }, { status: 502 });
  }

  if (!paid) {
    // Not paid yet — the webhook will finalize once/if it succeeds.
    return NextResponse.json({ ok: false, pending: true }, { status: 202 });
  }

  const result = await finalizePaidOrder(paymentIntentId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, refunded: result.refunded ?? false },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, orderId: result.orderId });
}
