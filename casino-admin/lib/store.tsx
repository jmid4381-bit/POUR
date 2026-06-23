"use client";

import {
  createContext, useContext, useState,
  useEffect, useCallback, useMemo, type ReactNode,
} from "react";
import type { Beverage, Order } from "./types";
import { uid } from "./utils";
import { supabase } from "./supabase";
import { rowToOrder, type OrderRow } from "./supabase-orders";
import { rowToBeverage, beverageToRow, type BeverageRow } from "./supabase-beverages";
import { logAudit } from "./audit";

// ─── State ────────────────────────────────────────────────────────────────────

const ORDER_WINDOW_DAYS = 30;

interface AppState {
  beverages: Beverage[];
  orders:    Order[];
}

// Derive lifetime order counts per beverage from the loaded order window.
function withOrdersTotal(beverages: Beverage[], orders: Order[]): Beverage[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const item of order.items) {
      counts.set(item.beverageId, (counts.get(item.beverageId) ?? 0) + item.quantity);
    }
  }
  return beverages.map(b => ({ ...b, ordersTotal: counts.get(b.id) ?? b.ordersTotal ?? 0 }));
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface StoreCtx {
  state:          AppState;
  loading:        boolean;
  error:          string | null;
  refresh:        () => void;
  addBeverage:    (b: Omit<Beverage, "id" | "ordersTotal" | "createdAt">) => Promise<void>;
  updateBeverage: (b: Beverage) => Promise<void>;
  deleteBeverage: (id: string) => Promise<void>;
  updatePrice:    (id: string, price: number) => Promise<void>;
  toggleAvailable:(id: string) => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [rawBeverages, setRawBeverages] = useState<Beverage[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── Load orders (rolling window) + beverages from Supabase ────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - ORDER_WINDOW_DAYS * 86_400_000).toISOString();

    const [ordersRes, beveragesRes] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          id, section, floor, status, guest_note,
          placed_at, accepted_at, ready_at, delivered_at, staff_name, cancel_reason,
          guest_name, location_name,
          order_items ( beverage_id, beverage_name, unit_price, quantity, note )
        `)
        .gte("placed_at", since)
        .order("placed_at", { ascending: false }),
      // beverages: every column here is actually consumed by rowToBeverage,
      // so select("*") is intentional, not an oversight
      supabase
        .from("beverages")
        .select("*"),
    ]);

    if (ordersRes.error || beveragesRes.error) {
      console.error("Supabase fetch failed:",
        ordersRes.error?.message, beveragesRes.error?.message);
      setError(ordersRes.error?.message ?? beveragesRes.error?.message ?? "Failed to load data");
    } else {
      setError(null);
      setOrders((ordersRes.data as OrderRow[]).map(rowToOrder));
      setRawBeverages((beveragesRes.data as BeverageRow[]).map(r => rowToBeverage(r)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime — refetch on any order / item / beverage change ──────────────
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },      () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "beverages" },   () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const beverages = useMemo(() => withOrdersTotal(rawBeverages, orders), [rawBeverages, orders]);
  const state: AppState = { beverages, orders };

  // ── Beverage CRUD ───────────────────────────────────────────────────────────

  const addBeverage = useCallback(async (b: Omit<Beverage, "id" | "ordersTotal" | "createdAt">) => {
    const id = `bev-${uid()}`;
    const { error: err } = await supabase
      .from("beverages")
      .insert({ id, ...beverageToRow(b) });
    if (err) { console.error("Failed to add beverage:", err.message); return; }
    logAudit("add_beverage", "beverages", id, { name: b.name, price: b.price });
    await fetchAll();
  }, [fetchAll]);

  const updateBeverage = useCallback(async (b: Beverage) => {
    setRawBeverages(prev => prev.map(x => x.id === b.id ? b : x));
    const { id, ordersTotal, createdAt, updatedAt, ...rest } = b;
    const { error: err } = await supabase
      .from("beverages")
      .update(beverageToRow(rest))
      .eq("id", id);
    if (err) { console.error("Failed to update beverage:", err.message); await fetchAll(); }
    else logAudit("update_beverage", "beverages", id, { name: b.name, price: b.price });
  }, [fetchAll]);

  const deleteBeverage = useCallback(async (id: string) => {
    setRawBeverages(prev => prev.filter(b => b.id !== id));
    const { error: err } = await supabase.from("beverages").delete().eq("id", id);
    if (err) { console.error("Failed to delete beverage:", err.message); await fetchAll(); }
    else logAudit("delete_beverage", "beverages", id);
  }, [fetchAll]);

  const updatePrice = useCallback(async (id: string, price: number) => {
    setRawBeverages(prev => prev.map(b => b.id === id ? { ...b, price } : b));
    const { error: err } = await supabase.from("beverages").update({ price }).eq("id", id);
    if (err) { console.error("Failed to update price:", err.message); await fetchAll(); }
    else logAudit("update_price", "beverages", id, { newPrice: price });
  }, [fetchAll]);

  const toggleAvailable = useCallback(async (id: string) => {
    const target = rawBeverages.find(b => b.id === id);
    if (!target) return;
    const isAvailable = !target.isAvailable;
    setRawBeverages(prev => prev.map(b => b.id === id ? { ...b, isAvailable } : b));
    const { error: err } = await supabase.from("beverages").update({ is_available: isAvailable }).eq("id", id);
    if (err) { console.error("Failed to toggle availability:", err.message); await fetchAll(); }
    else logAudit("toggle_available", "beverages", id, { isAvailable });
  }, [rawBeverages, fetchAll]);

  return (
    <Ctx.Provider value={{
      state, loading, error, refresh: fetchAll,
      addBeverage, updateBeverage, deleteBeverage, updatePrice, toggleAvailable,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be inside <StoreProvider>");
  return ctx;
}
