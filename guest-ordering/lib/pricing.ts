/**
 * lib/pricing.ts — server-side order pricing + validation, in ONE place.
 *
 * Both the Stripe PaymentIntent amount (payments/create-intent) and the final
 * order (createOrder → submit_order) derive their money from this module, so a
 * client-submitted amount is never trusted and the two can never disagree.
 *
 * Server-only (reads via the anon client, like the order route always has).
 */

import { supabase } from "@/lib/supabase";

// ─── Rules (kept identical to the historic /api/orders route) ───────────────
export const MAX_NOTE_LEN            = 200;
export const MAX_ITEMS              = 20;
export const MAX_ALCOHOLIC_PER_WINDOW = 2;
export const ALCOHOL_WINDOW_MINUTES  = 10;
export const GIANT_UPCHARGE          = 1;

export const JULY4_SURCHARGE_AMOUNT  = 3;
export const JULY4_SURCHARGE_LABEL   = "4th of July Post Hour Surcharge";
export const JULY4_SURCHARGE_DELAY_MS = 60 * 60_000;

export interface PricingItemInput {
  beverage: { id: string };
  quantity: number;
  note?:    string;
  size?:    "regular" | "giant";
}

export interface OrderItemRow {
  beverage_id:   string;
  beverage_name: string;
  unit_price:    number;
  quantity:      number;
  note:          string | null;
}

export type PricingResult =
  | { ok: false; status: number; error: string; cooldownMs?: number }
  | {
      ok:              true;
      rows:            OrderItemRow[];
      surchargeAmount: number;
      surchargeLabel:  string | null;
      giantCount:      number;
      alcoholicQty:    number;
      /** Grand total the guest pays, in cents (for Stripe). */
      totalCents:      number;
    };

/**
 * Validates availability + cooldown + giant-cup inventory and computes the
 * authoritative money for an order. Returns a typed error (with an HTTP
 * status) instead of throwing, so callers can map it straight to a response.
 */
export async function computeOrderCharge(
  items:   PricingItemInput[],
  guestId: string | null,
): Promise<PricingResult> {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return { ok: false, status: 400, error: "Invalid order payload" };
  }

  // Real prices/flags come from the DB — never from the client.
  const beverageIds = [...new Set(items.map(i => String(i.beverage.id)))];
  const { data: beverages, error: bevErr } = await supabase
    .from("beverages")
    .select("id, name, price, is_available, is_alcoholic")
    .in("id", beverageIds);

  if (bevErr || !beverages) {
    return { ok: false, status: 500, error: "Failed to validate order items" };
  }

  const beverageMap = new Map(beverages.map(b => [b.id, b]));
  for (const item of items) {
    const bev = beverageMap.get(String(item.beverage.id));
    if (!bev || !bev.is_available) {
      return { ok: false, status: 400, error: "One or more items are no longer available" };
    }
  }

  // Alcohol cooldown — tied to the guest's persistent cookie id.
  const alcoholicQty = items.reduce((sum, item) => {
    const bev = beverageMap.get(String(item.beverage.id));
    return bev?.is_alcoholic ? sum + (Number(item.quantity) || 0) : sum;
  }, 0);

  if (alcoholicQty > 0 && guestId) {
    const { data: statusRows, error: statusErr } = await supabase
      .rpc("get_guest_alcohol_status", {
        p_guest_id: String(guestId),
        p_window_minutes: ALCOHOL_WINDOW_MINUTES,
      });
    if (!statusErr && statusRows && statusRows.length > 0) {
      const { consumed, oldest_at } = statusRows[0] as { consumed: number; oldest_at: string | null };
      const room = Math.max(0, MAX_ALCOHOLIC_PER_WINDOW - consumed);
      if (alcoholicQty > room) {
        const cooldownMs = oldest_at
          ? Math.max(0, new Date(oldest_at).getTime() + ALCOHOL_WINDOW_MINUTES * 60_000 - Date.now())
          : 0;
        return { ok: false, status: 429, error: "Alcoholic drink limit reached for this window", cooldownMs };
      }
    }
  }

  // Surcharge — flat, once per order, only when the event has been running an
  // hour and the order contains alcohol.
  let surchargeAmount = 0;
  let surchargeLabel: string | null = null;
  if (alcoholicQty > 0) {
    const { data: eventRow } = await supabase
      .from("event_settings")
      .select("july4_started_at, july4_surcharge_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (
      eventRow?.july4_surcharge_enabled &&
      eventRow.july4_started_at &&
      Date.now() - new Date(eventRow.july4_started_at).getTime() >= JULY4_SURCHARGE_DELAY_MS
    ) {
      surchargeAmount = JULY4_SURCHARGE_AMOUNT;
      surchargeLabel = JULY4_SURCHARGE_LABEL;
    }
  }

  // Giant cup availability — reject before charging if inventory can't cover it.
  const giantCount = items.reduce((sum, item) =>
    item.size === "giant" ? sum + Math.min(8, Math.max(1, Number(item.quantity) || 1)) : sum, 0
  );
  if (giantCount > 0) {
    const { data: cupRow } = await supabase
      .from("event_settings")
      .select("giant_cups_available")
      .eq("id", 1)
      .maybeSingle();
    const available = typeof cupRow?.giant_cups_available === "number" ? cupRow.giant_cups_available : 0;
    if (available < giantCount) {
      return { ok: false, status: 409, error: "Giant cups are no longer available — please order Regular instead." };
    }
  }

  const rows: OrderItemRow[] = items.map(item => {
    const bev     = beverageMap.get(String(item.beverage.id))!;
    const isGiant = item.size === "giant";
    return {
      beverage_id:   bev.id,
      beverage_name: (isGiant ? bev.name + " (Giant)" : bev.name).slice(0, 200),
      unit_price:    Number(bev.price) + (isGiant ? GIANT_UPCHARGE : 0),
      quantity:      Math.min(8, Math.max(1, Number(item.quantity) || 1)),
      note:          item.note ? String(item.note).slice(0, MAX_NOTE_LEN) : null,
    };
  });

  const itemsTotal = rows.reduce((s, r) => s + r.unit_price * r.quantity, 0);
  const grandTotal = itemsTotal + surchargeAmount;
  const totalCents = Math.round(grandTotal * 100);

  return { ok: true, rows, surchargeAmount, surchargeLabel, giantCount, alcoholicQty, totalCents };
}
