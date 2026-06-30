import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ─── In-memory rate limiter ────────────────────────────────────────────────
// Best-effort: resets on cold start and isn't shared across regions/instances.
// Sufficient to deter a casual script flooding a single QR location; for
// guaranteed cross-instance limits, move to Upstash/Vercel KV later.

const WINDOW_MS       = 60_000;
const MAX_PER_WINDOW  = 5;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

// ─── Input limits ─────────────────────────────────────────────────────────

const MAX_NOTE_LEN = 200;
const MAX_ITEMS     = 20;

// Sliding window enforced server-side, tied to the guest's persistent
// cookie ID — not the client's sessionStorage, which a guest can reset by
// just closing the tab. This is the real boundary; the client-side cap is
// just an instant-feedback UX hint that mirrors this.
const MAX_ALCOHOLIC_PER_WINDOW = 2;
const ALCOHOL_WINDOW_MINUTES   = 10;

// 4th of July event — flat surcharge on any order containing alcohol,
// once the admin-triggered event has been running for an hour.
const JULY4_SURCHARGE_AMOUNT       = 3;
const JULY4_SURCHARGE_LABEL        = "4th of July Post Hour Surcharge";
const JULY4_SURCHARGE_DELAY_MS     = 60 * 60_000;

interface OrderPayload {
  id:               string;
  locationId:       string;
  locationName:     string;
  section:          string;
  floor:            number;
  estimatedMinutes: number;
  placedAt:         string;
  status:           string;
  ageBracket?:      string;
  ageVerifiedAt?:   string;
  guestId?:         string;
  guestName?:       string;
  items: {
    beverage: { id: string; name: string; price: number };
    quantity: number;
    note?:    string;
    size?:    "regular" | "giant";
  }[];
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many orders placed too quickly. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: { order?: OrderPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const order = body.order;
  if (!order?.id || !Array.isArray(order.items) || order.items.length === 0 || order.items.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
  }

  // Look up real prices server-side — never trust price/name sent by the client.
  const beverageIds = [...new Set(order.items.map(item => String(item.beverage.id)))];
  const { data: beverages, error: bevErr } = await supabase
    .from("beverages")
    .select("id, name, price, is_available, is_alcoholic")
    .in("id", beverageIds);

  if (bevErr || !beverages) {
    return NextResponse.json({ error: "Failed to validate order items" }, { status: 500 });
  }

  const beverageMap = new Map(beverages.map(b => [b.id, b]));
  for (const item of order.items) {
    const bev = beverageMap.get(String(item.beverage.id));
    if (!bev || !bev.is_available) {
      return NextResponse.json({ error: "One or more items are no longer available" }, { status: 400 });
    }
  }

  // Server-side alcohol cooldown — the real enforcement boundary, tied to
  // the guest's persistent cookie ID rather than client-trusted state.
  const alcoholicQtyThisOrder = order.items.reduce((sum, item) => {
    const bev = beverageMap.get(String(item.beverage.id));
    return bev?.is_alcoholic ? sum + (Number(item.quantity) || 0) : sum;
  }, 0);

  if (alcoholicQtyThisOrder > 0 && order.guestId) {
    const { data: statusRows, error: statusErr } = await supabase
      .rpc("get_guest_alcohol_status", {
        p_guest_id: String(order.guestId),
        p_window_minutes: ALCOHOL_WINDOW_MINUTES,
      });

    if (!statusErr && statusRows && statusRows.length > 0) {
      const { consumed, oldest_at } = statusRows[0] as { consumed: number; oldest_at: string | null };
      const room = Math.max(0, MAX_ALCOHOLIC_PER_WINDOW - consumed);

      if (alcoholicQtyThisOrder > room) {
        const cooldownMs = oldest_at
          ? Math.max(0, new Date(oldest_at).getTime() + ALCOHOL_WINDOW_MINUTES * 60_000 - Date.now())
          : 0;
        return NextResponse.json(
          { error: "Alcoholic drink limit reached for this window", cooldownMs },
          { status: 429 },
        );
      }
    }
  }

  // 4th of July surcharge — flat fee, applied once per order, only if the
  // event has been started and an hour has elapsed, and only if any item
  // in this order is alcoholic.
  let surchargeAmount = 0;
  let surchargeLabel: string | null = null;
  if (alcoholicQtyThisOrder > 0) {
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

  // Server-side giant cup check — reject before inserting if the inventory
  // can't cover this order's giant items, closing the race window where two
  // guests simultaneously see cups available but only one can actually get one.
  const giantCount = order.items.reduce((sum, item) =>
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
      return NextResponse.json(
        { error: "Giant cups are no longer available — please order Regular instead." },
        { status: 409 },
      );
    }
  }

  const GIANT_UPCHARGE = 1;
  const rows = order.items.map(item => {
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

  // Order + items inserted atomically via RPC — either both land or neither
  // does, and a duplicate order ID is a safe no-op rather than a hard error.
  const { error: submitErr } = await supabase.rpc("submit_order", {
    p_id:                String(order.id),
    p_location_id:       String(order.locationId),
    p_location_name:     String(order.locationName).slice(0, 200),
    p_section:           String(order.section).slice(0, 200),
    p_floor:             Number(order.floor),
    p_estimated_minutes: Number(order.estimatedMinutes),
    p_status:            String(order.status),
    p_placed_at:         String(order.placedAt),
    p_age_verified:      order.ageBracket ? true : null,
    p_age_bracket:       order.ageBracket ? String(order.ageBracket).slice(0, 32) : null,
    p_age_verified_at:   order.ageVerifiedAt ? String(order.ageVerifiedAt) : null,
    p_items:             rows,
    p_guest_id:          order.guestId ? String(order.guestId) : null,
    p_guest_name:        (order.guestName ? String(order.guestName).trim() : "").slice(0, 30) || "Guest",
    p_surcharge_amount:  surchargeAmount,
    p_surcharge_label:   surchargeLabel,
  });

  if (submitErr) {
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  // Decrement giant cup inventory for each giant item ordered — best-effort,
  // floored at 0 by the RPC so concurrent orders can't go negative.
  if (giantCount > 0) {
    await supabase.rpc("decrement_giant_cups", { p_count: giantCount });
  }

  return NextResponse.json({ ok: true, surchargeAmount, surchargeLabel });
}
