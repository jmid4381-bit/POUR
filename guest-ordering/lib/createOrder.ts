/**
 * lib/createOrder.ts — the ONE server-side path that creates an order.
 *
 * Used by both the free path (/api/orders, $0 orders) and the paid path
 * (payments/finalize + the Stripe webhook). Wraps the existing atomic
 * submit_order RPC (which re-validates prices/cooldown/giant-cups server-side
 * and is idempotent by order id via ON CONFLICT), then stamps the Stripe
 * PaymentIntent id onto the row when there is one.
 *
 * Server-only.
 */

import { supabase } from "@/lib/supabase";
import type { OrderItemRow } from "@/lib/pricing";

export interface OrderMeta {
  id:               string;
  locationId:       string;
  locationName:     string;
  section:          string;
  floor:            number;
  estimatedMinutes: number;
  placedAt:         string;
  status:           string;
  ageBracket?:      string | null;
  ageVerifiedAt?:   string | null;
  guestId?:         string | null;
  guestName?:       string | null;
}

export type CreateOrderResult = { ok: true } | { ok: false; error: string };

export async function createOrder(
  meta:  OrderMeta,
  rows:  OrderItemRow[],
  surchargeAmount: number,
  surchargeLabel:  string | null,
  stripePaymentIntentId?: string | null,
): Promise<CreateOrderResult> {
  // Atomic order + items insert. submit_order re-derives prices, re-checks the
  // cooldown, and does the atomic giant-cup check+decrement internally — it is
  // the real authority regardless of what we pass here, and a duplicate order
  // id is a safe no-op (so the webhook and the client can both call this).
  const { error: submitErr } = await supabase.rpc("submit_order", {
    p_id:                String(meta.id),
    p_location_id:       String(meta.locationId),
    p_location_name:     String(meta.locationName).slice(0, 200),
    p_section:           String(meta.section).slice(0, 200),
    p_floor:             Number(meta.floor),
    p_estimated_minutes: Number(meta.estimatedMinutes),
    p_status:            String(meta.status),
    p_placed_at:         String(meta.placedAt),
    p_age_verified:      meta.ageBracket ? true : null,
    p_age_bracket:       meta.ageBracket ? String(meta.ageBracket).slice(0, 32) : null,
    p_age_verified_at:   meta.ageVerifiedAt ? String(meta.ageVerifiedAt) : null,
    p_items:             rows,
    p_guest_id:          meta.guestId ? String(meta.guestId) : null,
    p_guest_name:        (meta.guestName ? String(meta.guestName).trim() : "").slice(0, 30) || "Guest",
    p_surcharge_amount:  surchargeAmount,
    p_surcharge_label:   surchargeLabel,
  });

  if (submitErr) {
    return { ok: false, error: submitErr.message };
  }

  // Record which payment paid for this order. Separate SECURITY DEFINER RPC so
  // the money-critical submit_order function is left untouched; it only sets
  // the id when currently null, so a retry/webhook double-call is a no-op.
  if (stripePaymentIntentId) {
    await supabase.rpc("set_order_payment_intent", {
      p_id:    String(meta.id),
      p_pi_id: String(stripePaymentIntentId),
    });
  }

  return { ok: true };
}
