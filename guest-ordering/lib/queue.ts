/**
 * lib/queue.ts — data bridge between guest ordering and Supabase.
 *
 * Every function tries Supabase first.
 * If Supabase is unreachable, it falls back to localStorage so the
 * app keeps working during connectivity issues.
 *
 * No component files import from Supabase directly — they all go through
 * this file. When the schema changes, only this file needs updating.
 */

import { supabase }    from "./supabase";
import type { CartItem } from "./data";

// ─── localStorage fallback keys ───────────────────────────────────────────────

const ORDER_QUEUE_KEY   = "casino_order_queue";
const ADMIN_DATA_KEY    = "casino-admin-v1";
const LOCATION_DATA_KEY = "casino_locations_v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueuedOrderStatus =
  | "pending" | "accepted" | "preparing"
  | "ready"   | "delivered"| "cancelled";

export interface QueuedOrder {
  id:               string;
  locationId:       string;
  locationName:     string;
  section:          string;
  floor:            number;
  items:            CartItem[];
  estimatedMinutes: number;
  placedAt:         string;
  status:           QueuedOrderStatus;
  updatedAt?:       string;
  // Age verification record — bracket + timestamp only, never the birthdate
  ageBracket?:      string;
  ageVerifiedAt?:   string;
  // Persistent guest identifier (cookie-based) — sent through so future
  // server-side checks (e.g. the cooldown) can be tied to a real guest,
  // not just a tab's ephemeral sessionStorage
  guestId?:         string;
  // The name the guest chose to be called — defaults to "Guest" if skipped
  guestName?:       string;
}

export interface AdminBeverage {
  id:          string;
  name:        string;
  price:       number;
  isAvailable: boolean;
  isFeatured:  boolean;
  isAlcoholic: boolean;
  prepMinutes: number;
  category:    string;
  emoji:       string;
  description: string;
}

export interface AdminLocation {
  id:       string;
  name:     string;
  section:  string;
  floor:    number;
  isActive: boolean;
}

// ─── Order submission ─────────────────────────────────────────────────────────

export interface SubmitOrderResult {
  ok:              boolean;
  rateLimited?:    boolean;
  cooldownBlocked?: boolean;
  cooldownMs?:     number;
}

// Order submission goes through our own API route (not directly to Supabase)
// so it can be rate-limited and cooldown-checked server-side — a script
// bypassing client-side checks, or a guest who just closes their tab,
// can't bypass either.
export async function submitOrder(order: QueuedOrder): Promise<SubmitOrderResult> {
  try {
    const res = await fetch("/api/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ order }),
    });

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      // The alcohol cooldown rejection includes cooldownMs; the plain
      // request-rate limiter doesn't — that's how we tell them apart.
      if (typeof body.cooldownMs === "number") {
        return { ok: false, cooldownBlocked: true, cooldownMs: body.cooldownMs };
      }
      return { ok: false, rateLimited: true };
    }
    if (!res.ok) throw new Error(`Order submission failed: ${res.status}`);

    return { ok: true };

  } catch (err) {
    // API route unreachable — fall back to localStorage so the guest still
    // sees a confirmation screen and the order isn't silently lost
    console.warn("Order API unavailable, falling back to localStorage:", err);
    _submitOrderToLocalStorage(order);
    return { ok: true };
  }
}

// ─── Order status polling (for the progress tracker) ─────────────────────────

export async function readOrderStatus(orderId: string): Promise<QueuedOrderStatus> {
  try {
    // Calls a narrow RPC (not a direct table SELECT) — the anon key can only
    // look up a single order's status by ID, never browse the orders table.
    const { data, error } = await supabase.rpc("get_order_status", { p_order_id: orderId });

    if (error) throw error;
    return (data as QueuedOrderStatus) ?? "pending";

  } catch {
    // Fall back to localStorage queue
    const queue = _readLocalQueue();
    return queue.find(o => o.id === orderId)?.status ?? "pending";
  }
}

// Returns the assigned staff member's name once accepted, or null if no
// one has claimed the order yet.
export async function readOrderStaffName(orderId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_order_staff_name", { p_order_id: orderId });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}

const ALCOHOL_WINDOW_MINUTES = 10;
const MAX_ALCOHOLIC_PER_WINDOW = 2;

// Reads the guest's REAL alcohol cooldown from the server (the same check
// enforced on order submission) — not a local timer, so it reflects what
// will actually happen if they try to order, and survives a page refresh.
// Returns 0 if there's no active cooldown.
export async function readAlcoholCooldownMs(guestId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("get_guest_alcohol_status", {
      p_guest_id: guestId,
      p_window_minutes: ALCOHOL_WINDOW_MINUTES,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const consumed: number = row?.consumed ?? 0;
    const oldestAt: string | null = row?.oldest_at ?? null;

    if (consumed < MAX_ALCOHOLIC_PER_WINDOW || !oldestAt) return 0;
    return Math.max(0, new Date(oldestAt).getTime() + ALCOHOL_WINDOW_MINUTES * 60_000 - Date.now());
  } catch {
    return 0;
  }
}

// ─── Queue depth for ETA calculation ─────────────────────────────────────────

export async function getQueueDepth(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "accepted", "preparing", "ready"])
      .gte("placed_at", cutoff);

    if (error) throw error;
    return count ?? 0;

  } catch {
    // Fall back to localStorage
    const queue  = _readLocalQueue();
    const cutoff = Date.now() - 30 * 60 * 1000;
    return queue.filter(o =>
      ["pending","accepted","preparing","ready"].includes(o.status) &&
      new Date(o.placedAt).getTime() > cutoff
    ).length;
  }
}

export function calculateETA(cartItems: CartItem[], queueDepth: number): number {
  if (cartItems.length === 0) return 8;
  const longest      = Math.max(...cartItems.map(i => i.beverage.prepMinutes));
  const base         = longest + 4;
  const queuePenalty = Math.min(queueDepth * 1.5, 20);
  return Math.round(Math.min(Math.max(base + queuePenalty, 5), 45));
}

// ─── Beverage menu (for useMenu hook) ────────────────────────────────────────

export async function readAdminBeverages(): Promise<AdminBeverage[] | null> {
  try {
    const { data, error } = await supabase
      .from("beverages")
      .select("id, name, price, is_available, is_featured, is_alcoholic, prep_minutes, category, emoji, description");

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data.map(b => ({
      id:          b.id,
      name:        b.name,
      price:       Number(b.price),
      isAvailable: b.is_available,
      isFeatured:  b.is_featured,
      isAlcoholic: b.is_alcoholic,
      prepMinutes: b.prep_minutes,
      category:    b.category,
      emoji:       b.emoji ?? "",
      description: b.description ?? "",
    }));

  } catch {
    // Fall back to admin's localStorage store
    return _readAdminBeveragesFromLocalStorage();
  }
}

// ─── Locations (for useMenu hook) ────────────────────────────────────────────

export async function readAdminLocations(): Promise<AdminLocation[] | null> {
  try {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, section, floor, is_active");

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data.map(l => ({
      id:       l.id,
      name:     l.name,
      section:  l.section,
      floor:    l.floor,
      isActive: l.is_active,
    }));

  } catch {
    return _readAdminLocationsFromLocalStorage();
  }
}

// ─── localStorage fallback helpers (private) ─────────────────────────────────

function _readLocalQueue(): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(ORDER_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _submitOrderToLocalStorage(order: QueuedOrder): void {
  try {
    const existing = _readLocalQueue();
    if (existing.some(o => o.id === order.id)) return;
    localStorage.setItem(
      ORDER_QUEUE_KEY,
      JSON.stringify([order, ...existing].slice(0, 200))
    );
  } catch { /* quota or SSR */ }
}

function _readAdminBeveragesFromLocalStorage(): AdminBeverage[] | null {
  try {
    const raw = localStorage.getItem(ADMIN_DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.beverages) || !data.beverages.length) return null;
    return data.beverages;
  } catch { return null; }
}

function _readAdminLocationsFromLocalStorage(): AdminLocation[] | null {
  try {
    const raw = localStorage.getItem(LOCATION_DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length ? data : null;
  } catch { return null; }
}
