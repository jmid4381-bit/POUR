"use client";

/**
 * lib/guestOrderHistory.ts — restores a returning guest's past orders from
 * Supabase, keyed by their persistent guest-ID cookie (see guestSession.ts).
 *
 * This is purely informational — it powers the My Orders panel's history
 * list and spend total for a guest who closed their tab and came back.
 * It is never read by the alcohol cooldown check, which stays exactly as
 * it was: cookie + server-side RPC, untouched by this file.
 */

import { supabase } from "@/lib/supabase";
import type { Beverage, CartItem } from "@/lib/data";
import type { HistoryOrder } from "@/hooks/useOrderHistory";
import type { QueuedOrderStatus } from "@/lib/queue";

// Matches the guest-ID cookie's own Max-Age and the "Welcome back" remember
// window — a guest outside this window has already lost both, so there's
// nothing to restore either way.
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

interface GuestOrderItemRow {
  beverage_id:   string | null;
  beverage_name: string;
  unit_price:    number | null;
  quantity:      number;
  note:          string | null;
}

interface GuestOrderRow {
  id:                string;
  location_name:     string;
  estimated_minutes: number | null;
  placed_at:         string;
  status:            QueuedOrderStatus;
  staff_name:        string | null;
  surcharge_amount:  number | null;
  surcharge_label:   string | null;
  items:             GuestOrderItemRow[] | null;
}

export async function fetchGuestOrderHistory(
  guestId: string,
  beverages: Beverage[],
): Promise<HistoryOrder[]> {
  try {
    const since = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
    const { data, error } = await supabase.rpc("get_guest_orders", {
      p_guest_id: guestId,
      p_since:    since,
    });
    if (error || !data) return [];

    const beverageMap = new Map(beverages.map(b => [b.id, b]));

    return (data as GuestOrderRow[]).map(row => {
      const items: CartItem[] = (row.items ?? []).map(item => {
        const live = beverageMap.get(item.beverage_id ?? "");
        // Falls back to a minimal reconstructed beverage if it's since been
        // removed from the menu — keeps the historical line item readable
        // (name + price as charged) instead of dropping it silently.
        const beverage: Beverage = live ?? {
          id:          item.beverage_id ?? "",
          name:        item.beverage_name,
          tagline:     "", description: "", ingredients: [],
          category:    "cocktail", emoji: "🍹",
          price:       item.unit_price ?? 0,
          isAlcoholic: false, isAvailable: false, isFeatured: false,
          isSignature: false, isVip: false, prepMinutes: 0, tags: [],
        };
        return {
          beverage: { ...beverage, price: item.unit_price ?? beverage.price },
          quantity: item.quantity,
          note:     item.note ?? "",
        };
      });

      return {
        id:               row.id,
        locationName:     row.location_name,
        items,
        estimatedMinutes: row.estimated_minutes ?? 0,
        placedAt:         row.placed_at,
        status:           row.status,
        staffName:        row.staff_name ?? undefined,
        surchargeAmount:  row.surcharge_amount ?? 0,
        surchargeLabel:   row.surcharge_label ?? undefined,
      };
    });
  } catch {
    return [];
  }
}
