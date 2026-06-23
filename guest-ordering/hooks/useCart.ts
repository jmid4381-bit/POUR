"use client";

/**
 * useCart — Fix 5
 *
 * Persists the cart to sessionStorage so a phone going to sleep,
 * an accidental browser back, or a soft reload doesn't lose a VIP
 * guest's $300 champagne order.
 *
 * Uses sessionStorage (not localStorage) deliberately:
 * - Scoped to this browser tab — a new tab starts fresh
 * - Automatically cleared when the session ends
 * - Prevents stale cart data from appearing in future visits
 *
 * Keyed by locationId so a guest at Table 12 and another at the
 * VIP Lounge on the same device don't share a cart.
 */

import { useState, useEffect, useCallback } from "react";
import type { CartItem, Beverage } from "@/lib/data";

const CART_VERSION = "v2";
const MAX_ALCOHOLIC_PER_ORDER = 2;

// Sliding 10-minute window: alcoholic drinks already *placed* (not just in
// cart) count against the limit for 10 minutes from when each was ordered.
// Order 2 within the window and you're at 0 room until they age out; order
// just 1 and there's still room for 1 more during that same window.
const ALCOHOL_WINDOW_MS = 10 * 60 * 1000;
const ALCOHOL_LOG_VERSION = "v1";

interface AlcoholLogEntry { quantity: number; at: number }

function cartKey(locationId: string): string {
  return `casino_cart_${CART_VERSION}_${locationId}`;
}

function alcoholLogKey(locationId: string): string {
  return `casino_alcohol_log_${ALCOHOL_LOG_VERSION}_${locationId}`;
}

function saveCart(locationId: string, cart: CartItem[]): void {
  try {
    sessionStorage.setItem(cartKey(locationId), JSON.stringify(cart));
  } catch { /* storage full or SSR */ }
}

function loadCart(locationId: string): CartItem[] {
  try {
    const raw = sessionStorage.getItem(cartKey(locationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    // Validate — items must have price, name, id
    return parsed.filter(i =>
      i.beverage?.id && i.beverage?.price != null && i.quantity > 0
    );
  } catch {
    return [];
  }
}

function clearCart(locationId: string): void {
  try { sessionStorage.removeItem(cartKey(locationId)); }
  catch { /* ignore */ }
}

// Reads the log and drops anything older than the window in the same pass,
// so it never grows unbounded over a long session.
function loadAlcoholLog(locationId: string): AlcoholLogEntry[] {
  try {
    const raw = sessionStorage.getItem(alcoholLogKey(locationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AlcoholLogEntry[];
    const cutoff = Date.now() - ALCOHOL_WINDOW_MS;
    return parsed.filter(e => e.at > cutoff);
  } catch { return []; }
}

function saveAlcoholLog(locationId: string, log: AlcoholLogEntry[]): void {
  try { sessionStorage.setItem(alcoholLogKey(locationId), JSON.stringify(log)); }
  catch { /* ignore */ }
}

function alcoholConsumedInWindow(locationId: string): number {
  return loadAlcoholLog(locationId).reduce((s, e) => s + e.quantity, 0);
}

// ms until enough of the window's oldest entries expire to free up at least
// one more drink of room — used for the cooldown message, not for gating.
function alcoholCooldownRemainingMs(locationId: string): number {
  const log = loadAlcoholLog(locationId);
  if (log.length === 0) return 0;
  const consumed = log.reduce((s, e) => s + e.quantity, 0);
  if (consumed < MAX_ALCOHOLIC_PER_ORDER) return 0;
  const oldest = Math.min(...log.map(e => e.at));
  return Math.max(0, (oldest + ALCOHOL_WINDOW_MS) - Date.now());
}

export function useCart(locationId: string) {
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore from sessionStorage on mount (client only)
  useEffect(() => {
    setCartState(loadCart(locationId));
    setHydrated(true);
  }, [locationId]);

  // Persist on every change (after hydration to avoid overwriting with empty)
  useEffect(() => {
    if (!hydrated) return;
    saveCart(locationId, cart);
  }, [cart, locationId, hydrated]);

  // Adds an item, capping total alcoholic drinks at MAX_ALCOHOLIC_PER_ORDER
  // across this cart PLUS whatever's still counted from recently placed
  // orders (the 10-minute sliding window). Non-alcoholic items are never
  // capped. Returns how much actually got added, whether the limit clipped
  // the request, and ms remaining on the cooldown if fully blocked.
  const addItem = useCallback((beverage: Beverage, qty: number, note: string): { added: number; capped: boolean; cooldownMs: number } => {
    let added  = qty;
    let capped = false;
    let cooldownMs = 0;

    setCartState(prev => {
      if (beverage.isAlcoholic) {
        const currentAlcoholicQty = prev.reduce(
          (s, i) => i.beverage.isAlcoholic ? s + i.quantity : s, 0
        );
        const windowQty = alcoholConsumedInWindow(locationId);
        const room = Math.max(0, MAX_ALCOHOLIC_PER_ORDER - currentAlcoholicQty - windowQty);
        capped = qty > room;
        added  = Math.min(qty, room);
        if (added <= 0) {
          cooldownMs = alcoholCooldownRemainingMs(locationId);
          return prev;
        }
      }

      const idx = prev.findIndex(i => i.beverage.id === beverage.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + added };
        return next;
      }
      return [...prev, { beverage, quantity: added, note }];
    });

    return { added, capped, cooldownMs };
  }, [locationId]);

  const removeItem = useCallback((beverageId: string) => {
    setCartState(prev => prev.filter(i => i.beverage.id !== beverageId));
  }, []);

  // Increasing an alcoholic item's quantity is also capped at the same
  // total-alcoholic-drinks limit as adding a brand new item.
  const updateQty = useCallback((beverageId: string, delta: number): boolean => {
    let capped = false;

    setCartState(prev => prev.reduce<CartItem[]>((acc, item) => {
      if (item.beverage.id !== beverageId) return [...acc, item];

      let newQty = item.quantity + delta;
      if (delta > 0 && item.beverage.isAlcoholic) {
        const otherAlcoholicQty = prev.reduce(
          (s, i) => (i.beverage.id !== beverageId && i.beverage.isAlcoholic) ? s + i.quantity : s, 0
        );
        const windowQty = alcoholConsumedInWindow(locationId);
        const room = Math.max(0, MAX_ALCOHOLIC_PER_ORDER - otherAlcoholicQty - windowQty);
        if (newQty > room) { capped = true; newQty = room; }
      }

      if (newQty <= 0) return acc;
      return [...acc, { ...item, quantity: Math.min(8, newQty) }];
    }, []));

    return capped;
  }, [locationId]);

  const clearItems = useCallback(() => {
    setCartState([]);
    clearCart(locationId);
  }, [locationId]);

  // Call once an order has actually been placed (not just added to cart) —
  // records how many alcoholic drinks just left the building so the
  // 10-minute window correctly counts against future orders this session.
  const recordAlcoholicOrder = useCallback((quantity: number) => {
    if (quantity <= 0) return;
    const log = loadAlcoholLog(locationId);
    log.push({ quantity, at: Date.now() });
    saveAlcoholLog(locationId, log);
  }, [locationId]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.beverage.price * i.quantity, 0);

  return {
    cart, cartCount, cartTotal, hydrated,
    addItem, removeItem, updateQty, clearItems,
    recordAlcoholicOrder,
  };
}
