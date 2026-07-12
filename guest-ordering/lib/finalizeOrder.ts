/**
 * lib/finalizeOrder.ts — turn a paid PaymentIntent into a real order.
 *
 * Called by BOTH the client-facing finalize route (instant confirmation) and
 * the Stripe webhook (source of truth if the client is interrupted). Safe to
 * call twice for the same PaymentIntent: order creation is idempotent by order
 * id, and the pending-order status guard short-circuits the second call.
 *
 * If payment succeeded but the order can't be created (e.g. the last Giant cup
 * was taken in the seconds between paying and finalizing), the PaymentIntent
 * is refunded so the guest is never charged for an order that didn't happen.
 *
 * Server-only.
 */

import { supabase } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { createOrder, type OrderMeta } from "@/lib/createOrder";
import type { OrderItemRow } from "@/lib/pricing";

interface PendingPayload {
  meta:            OrderMeta;
  rows:            OrderItemRow[];
  surchargeAmount: number;
  surchargeLabel:  string | null;
}

interface PendingRow {
  id:                string;
  payment_intent_id: string;
  payload:           PendingPayload;
  amount_cents:      number;
  status:            string;
}

export type FinalizeResult =
  | { ok: true; orderId: string; alreadyDone?: boolean }
  | { ok: false; error: string; refunded?: boolean };

export async function finalizePaidOrder(paymentIntentId: string): Promise<FinalizeResult> {
  const { data, error } = await supabase.rpc("get_pending_order", { p_payment_intent_id: paymentIntentId });
  const pending = (Array.isArray(data) ? data[0] : data) as PendingRow | null | undefined;

  if (error || !pending) {
    return { ok: false, error: "No pending order for this payment." };
  }
  if (pending.status === "fulfilled") {
    return { ok: true, orderId: pending.id, alreadyDone: true };
  }

  const { meta, rows, surchargeAmount, surchargeLabel } = pending.payload;

  const result = await createOrder(meta, rows, surchargeAmount, surchargeLabel, paymentIntentId);

  if (!result.ok) {
    // Paid, but couldn't fulfill — refund so the guest isn't charged for
    // nothing, and mark the pending order failed.
    let refunded = false;
    try {
      await getStripe().refunds.create({ payment_intent: paymentIntentId });
      refunded = true;
    } catch (refundErr) {
      console.error("Refund after failed fulfillment ALSO failed:", paymentIntentId, refundErr);
    }
    await supabase.rpc("mark_pending_order", { p_payment_intent_id: paymentIntentId, p_status: "failed" });
    return { ok: false, error: result.error, refunded };
  }

  await supabase.rpc("mark_pending_order", { p_payment_intent_id: paymentIntentId, p_status: "fulfilled" });
  return { ok: true, orderId: meta.id };
}
