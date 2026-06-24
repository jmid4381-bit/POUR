"use client";

import {
  createContext, useContext, useState,
  useEffect, useCallback, useMemo, type ReactNode,
} from "react";
import type { Beverage, Order, Location, StaffZone, ZoneRequest } from "./types";
import { uid } from "./utils";
import { supabase } from "./supabase";
import { rowToOrder, type OrderRow } from "./supabase-orders";
import { rowToBeverage, beverageToRow, type BeverageRow } from "./supabase-beverages";
import {
  rowToLocation, rowToStaffZone, rowToZoneRequest,
  type LocationRow, type StaffZoneRow, type ZoneRequestRow,
} from "./supabase-zones";
import { logAudit } from "./audit";

// ─── State ────────────────────────────────────────────────────────────────────

const ORDER_WINDOW_DAYS = 30;

interface AppState {
  beverages:    Beverage[];
  orders:       Order[];
  locations:    Location[];
  staffZones:   StaffZone[];
  zoneRequests: ZoneRequest[];
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
  approveZoneRequest: (req: ZoneRequest) => Promise<void>;
  denyZoneRequest:    (id: string) => Promise<void>;
  removeStaffZone:    (staffName: string, locationId: string) => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [rawBeverages, setRawBeverages] = useState<Beverage[]>([]);
  const [locations,    setLocations]    = useState<Location[]>([]);
  const [staffZones,   setStaffZones]   = useState<StaffZone[]>([]);
  const [zoneRequests, setZoneRequests] = useState<ZoneRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── Load orders (rolling window) + beverages + zones from Supabase ────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - ORDER_WINDOW_DAYS * 86_400_000).toISOString();

    const [ordersRes, beveragesRes, locationsRes, staffZonesRes, zoneRequestsRes] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          id, location_id, section, floor, status, guest_note,
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
      supabase
        .from("locations")
        .select("id, name, section, floor, is_active")
        .order("id"),
      supabase
        .from("staff_zones")
        .select("staff_name, location_id"),
      supabase
        .from("zone_requests")
        .select("id, staff_name, request_type, requested_zone_id, status, created_at, resolved_at")
        .order("created_at", { ascending: false }),
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

    if (!locationsRes.error)    setLocations((locationsRes.data as LocationRow[] ?? []).map(rowToLocation));
    if (!staffZonesRes.error)   setStaffZones((staffZonesRes.data as StaffZoneRow[] ?? []).map(rowToStaffZone));
    if (!zoneRequestsRes.error) setZoneRequests((zoneRequestsRes.data as ZoneRequestRow[] ?? []).map(rowToZoneRequest));

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime — refetch on any order / item / beverage / zone change ───────
  // Kept alongside the polling fallback below in case the project's Realtime
  // events start arriving reliably (push is instant when it works; polling
  // is the guaranteed floor).
  useEffect(() => {
    const log = (table: string) => (payload: unknown) => {
      // eslint-disable-next-line no-console
      console.log(`[admin-realtime] ${table} event received:`, payload);
      fetchAll();
    };
    const channel = supabase
      .channel("admin-dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },        log("orders"))
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_zones" },   log("staff_zones"))
      .on("postgres_changes", { event: "*", schema: "public", table: "zone_requests" }, log("zone_requests"))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" },   log("order_items"))
      .on("postgres_changes", { event: "*", schema: "public", table: "beverages" },     log("beverages"))
      .subscribe((status, err) => {
        // eslint-disable-next-line no-console
        console.log("[admin-realtime] subscription status:", status, err ?? "");
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  // ── Polling fallback ────────────────────────────────────────────────────────
  // Realtime postgres_changes events were confirmed connecting (status:
  // SUBSCRIBED) but not actually arriving for any table during testing --
  // a project/Realtime-side issue, not something the app can fix directly.
  // This guarantees the dashboard self-corrects within a few seconds either
  // way, without depending on push events working at all. 8s strikes a
  // balance -- fast enough to feel live, slow enough not to make the UI
  // flicker/refresh visibly underfoot.
  useEffect(() => {
    const id = setInterval(fetchAll, 8_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const beverages = useMemo(() => withOrdersTotal(rawBeverages, orders), [rawBeverages, orders]);
  const state: AppState = { beverages, orders, locations, staffZones, zoneRequests };

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

  // ── Zone requests ────────────────────────────────────────────────────────────

  // "switch" drops every zone the staff member currently has and replaces it
  // with the requested one; "add" just adds the new zone alongside whatever
  // they already have. Either way the request itself is marked resolved in
  // the same action so it disappears from the pending list immediately.
  const approveZoneRequest = useCallback(async (req: ZoneRequest) => {
    if (req.requestType === "switch") {
      const { error: delErr } = await supabase.from("staff_zones").delete().eq("staff_name", req.staffName);
      if (delErr) { console.error("Failed to clear existing zones:", delErr.message); return; }
    }
    const { error: insErr } = await supabase
      .from("staff_zones")
      .upsert({ staff_name: req.staffName, location_id: req.requestedZoneId }, { onConflict: "staff_name,location_id" });
    if (insErr) { console.error("Failed to assign new zone:", insErr.message); return; }

    const { error: updErr } = await supabase
      .from("zone_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    if (!updErr) logAudit("approve_zone_request", "zone_requests", req.id, { staffName: req.staffName, zone: req.requestedZoneId });
    await fetchAll();
  }, [fetchAll]);

  const denyZoneRequest = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from("zone_requests")
      .update({ status: "denied", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (!err) logAudit("deny_zone_request", "zone_requests", id);
    await fetchAll();
  }, [fetchAll]);

  // Admin can unilaterally pull a staff member off a zone once they're done
  // helping out — no request/approval needed for this direction, since the
  // admin is the one initiating it.
  const removeStaffZone = useCallback(async (staffName: string, locationId: string) => {
    const { error: err } = await supabase
      .from("staff_zones")
      .delete()
      .eq("staff_name", staffName)
      .eq("location_id", locationId);
    if (!err) logAudit("remove_staff_zone", "staff_zones", `${staffName}:${locationId}`, { staffName, locationId });
    await fetchAll();
  }, [fetchAll]);

  return (
    <Ctx.Provider value={{
      state, loading, error, refresh: fetchAll,
      addBeverage, updateBeverage, deleteBeverage, updatePrice, toggleAvailable,
      approveZoneRequest, denyZoneRequest, removeStaffZone,
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
