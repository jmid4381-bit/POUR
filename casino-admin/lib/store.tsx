"use client";

import {
  createContext, useContext, useState, useRef,
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
import { logError, logMessage } from "./logger";
import { useSessionVenue, type VenueOption } from "@/hooks/useSessionVenue";

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
  // Venue context — which venue this signed-in admin is scoped to, and (for
  // platform_admin only) the means to switch which one is being viewed.
  venueId:          string | null;
  isPlatformAdmin:  boolean;
  venues:           VenueOption[];
  chooseVenue:      (venueId: string) => void;
  venueResolving:   boolean;
}

const Ctx = createContext<StoreCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const {
    venueId, isPlatformAdmin, venues, chooseVenue, resolving: venueResolving,
  } = useSessionVenue();
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [rawBeverages, setRawBeverages] = useState<Beverage[]>([]);
  const [locations,    setLocations]    = useState<Location[]>([]);
  const [staffZones,   setStaffZones]   = useState<StaffZone[]>([]);
  const [zoneRequests, setZoneRequests] = useState<ZoneRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // Timestamp of the most recent optimistic beverage mutation. A fetchAll()
  // that STARTED before this timestamp has a beverages snapshot taken before
  // that mutation happened -- applying it would revert the mutation the
  // instant the poll resolves, which is exactly the "hurry up to beat the
  // poll" bug: edit something, then watch it flicker back to the old value
  // a moment later because an in-flight fetch that started just before your
  // edit lands just after it. Comparing fetch-start-time against this
  // timestamp lets a late-arriving stale response skip the beverages field
  // only, while still applying everything else in that response normally.
  const lastBevMutationAt = useRef(0);

  // Every admin page does `if (loading) return <...spinner...>` -- a full
  // replacement of the page tree, which unmounts any open modal/edit state.
  // `loading` must only be true for the VERY FIRST fetch (before there's any
  // data on screen yet); a background poll refresh must never flip it back
  // on, or it kicks the admin out of whatever they're doing every single
  // poll tick -- exactly the "can't type a price before it refreshes and
  // kicks me out" bug, and the real reason shortening the interval made it
  // so much worse.
  const hasLoadedOnce = useRef(false);

  // Always holds the CURRENT venueId, updated synchronously during render
  // (not on effect-cleanup timing) -- lets fetchAll detect "the venue
  // changed again while I was in flight" and discard its own response
  // instead of overwriting newer data with a stale one, when a platform_admin
  // switches venues quickly (see the venue-switcher glitch this fixes).
  const venueIdRef = useRef(venueId);
  venueIdRef.current = venueId;

  // Clear all venue-scoped state THE INSTANT venueId changes, rather than
  // waiting for the next fetchAll() to resolve -- otherwise the previous
  // venue's already-rendered orders/beverages/etc. stay on screen for a
  // beat after switching, which is exactly the "flashes the other venue"
  // symptom reported when using the switcher.
  useEffect(() => {
    setOrders([]);
    setRawBeverages([]);
    setLocations([]);
    setStaffZones([]);
    setZoneRequests([]);
  }, [venueId]);

  // ── Load orders (rolling window) + beverages + zones from Supabase ────────
  const fetchAll = useCallback(async () => {
    if (!venueId) { setLoading(false); return; }
    const requestedVenueId = venueId;
    const fetchStartedAt = Date.now();
    if (!hasLoadedOnce.current) setLoading(true);
    const since = new Date(Date.now() - ORDER_WINDOW_DAYS * 86_400_000).toISOString();

    const [ordersRes, beveragesRes, locationsRes, staffZonesRes, zoneRequestsRes] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          id, location_id, section, floor, status, guest_note,
          placed_at, accepted_at, ready_at, delivered_at, staff_name, cancel_reason,
          guest_name, location_name, surcharge_amount, surcharge_label,
          order_items ( beverage_id, beverage_name, unit_price, quantity, note )
        `)
        .eq("venue_id", venueId)
        .gte("placed_at", since)
        .order("placed_at", { ascending: false }),
      // beverages: every column here is actually consumed by rowToBeverage,
      // so select("*") is intentional, not an oversight
      supabase
        .from("beverages")
        .select("*")
        .eq("venue_id", venueId),
      supabase
        .from("locations")
        .select("id, name, section, floor, is_active")
        .eq("venue_id", venueId)
        .order("id"),
      supabase
        .from("staff_zones")
        .select("staff_name, location_id")
        .eq("venue_id", venueId),
      supabase
        .from("zone_requests")
        .select("id, staff_name, request_type, requested_zone_id, status, created_at, resolved_at")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false }),
    ]);

    // The venue switcher moved on again while these requests were in
    // flight -- this response belongs to a venue we're no longer viewing,
    // applying it would flash/overwrite the newer venue's data.
    if (requestedVenueId !== venueIdRef.current) return;

    if (ordersRes.error || beveragesRes.error) {
      const msg = ordersRes.error?.message ?? beveragesRes.error?.message ?? "Failed to load data";
      logError("Admin dashboard fetchAll failed", new Error(msg), {
        ordersError: ordersRes.error?.message ?? null,
        beveragesError: beveragesRes.error?.message ?? null,
      });
      setError(msg);
    } else {
      setError(null);
      setOrders((ordersRes.data as OrderRow[]).map(rowToOrder));
      // Skip applying this snapshot if a beverage was optimistically edited
      // after this particular fetch started -- see lastBevMutationAt above.
      if (fetchStartedAt >= lastBevMutationAt.current) {
        setRawBeverages((beveragesRes.data as BeverageRow[]).map(r => rowToBeverage(r)));
      }
    }

    if (!locationsRes.error)    setLocations((locationsRes.data as LocationRow[] ?? []).map(rowToLocation));
    if (!staffZonesRes.error)   setStaffZones((staffZonesRes.data as StaffZoneRow[] ?? []).map(rowToStaffZone));
    if (!zoneRequestsRes.error) setZoneRequests((zoneRequestsRes.data as ZoneRequestRow[] ?? []).map(rowToZoneRequest));

    hasLoadedOnce.current = true;
    setLoading(false);
  }, [venueId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime — refetch on any order / item / beverage / zone change ───────
  // Kept alongside the polling fallback below in case the project's Realtime
  // events start arriving reliably (push is instant when it works; polling
  // is the guaranteed floor). order_items has no venue_id column (see plan),
  // so its subscription stays unfiltered — it just triggers the same
  // fetchAll(), which is already venue-scoped above.
  useEffect(() => {
    if (!venueId) return;
    const channel = supabase
      .channel(`admin-dashboard-changes-${venueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `venue_id=eq.${venueId}` },      () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_zones", filter: `venue_id=eq.${venueId}` },   () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "zone_requests", filter: `venue_id=eq.${venueId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "beverages", filter: `venue_id=eq.${venueId}` },   () => fetchAll())
      .subscribe((status) => {
        // The comment below documents Realtime events connecting but not
        // arriving during earlier testing — logging CHANNEL_ERROR/TIMED_OUT
        // here gives an actual empirical signal on whether that's still
        // happening, instead of relying on the 3s poll to silently mask it.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logMessage("Realtime subscription failed: admin-dashboard-changes", { status });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll, venueId]);

  // ── Polling fallback ────────────────────────────────────────────────────────
  // Realtime postgres_changes events were confirmed connecting (status:
  // SUBSCRIBED) but not actually arriving for any table during testing --
  // a project/Realtime-side issue, not something the app can fix directly.
  // This guarantees the dashboard self-corrects within a few seconds either
  // way, without depending on push events working at all. Tightened from 8s
  // to 3s so any change made anywhere (a different admin, a guest order,
  // etc.) shows up much sooner -- combined with the beverage-mutation
  // staleness guard above, an admin's own edits are no longer at risk of
  // being reverted by this poll either.
  useEffect(() => {
    const id = setInterval(fetchAll, 3_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const beverages = useMemo(() => withOrdersTotal(rawBeverages, orders), [rawBeverages, orders]);
  const state: AppState = { beverages, orders, locations, staffZones, zoneRequests };

  // ── Beverage CRUD ───────────────────────────────────────────────────────────

  const addBeverage = useCallback(async (b: Omit<Beverage, "id" | "ordersTotal" | "createdAt">) => {
    if (!venueId) return;
    const id = `bev-${uid()}`;
    const createdAt = new Date().toISOString();
    // Optimistic insert -- the new drink appears in the table instantly
    // instead of waiting on a full refetch, and can't be raced by an
    // in-flight poll (guarded by lastBevMutationAt below).
    lastBevMutationAt.current = Date.now();
    setRawBeverages(prev => [...prev, { ...b, id, createdAt, ordersTotal: 0 }]);
    const { error: err } = await supabase
      .from("beverages")
      .insert({ id, venue_id: venueId, ...beverageToRow(b) });
    if (err) {
      console.error("Failed to add beverage:", err.message);
      setRawBeverages(prev => prev.filter(x => x.id !== id));
      return;
    }
    logAudit("add_beverage", "beverages", id, { name: b.name, price: b.price });
  }, [venueId]);

  const updateBeverage = useCallback(async (b: Beverage) => {
    lastBevMutationAt.current = Date.now();
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
    lastBevMutationAt.current = Date.now();
    setRawBeverages(prev => prev.filter(b => b.id !== id));
    const { error: err } = await supabase.from("beverages").delete().eq("id", id);
    if (err) { console.error("Failed to delete beverage:", err.message); await fetchAll(); }
    else logAudit("delete_beverage", "beverages", id);
  }, [fetchAll]);

  const updatePrice = useCallback(async (id: string, price: number) => {
    lastBevMutationAt.current = Date.now();
    setRawBeverages(prev => prev.map(b => b.id === id ? { ...b, price } : b));
    const { error: err } = await supabase.from("beverages").update({ price }).eq("id", id);
    if (err) { console.error("Failed to update price:", err.message); await fetchAll(); }
    else logAudit("update_price", "beverages", id, { newPrice: price });
  }, [fetchAll]);

  const toggleAvailable = useCallback(async (id: string) => {
    const target = rawBeverages.find(b => b.id === id);
    if (!target) return;
    const isAvailable = !target.isAvailable;
    lastBevMutationAt.current = Date.now();
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
    if (!venueId) return;
    if (req.requestType === "switch") {
      const { error: delErr } = await supabase.from("staff_zones").delete().eq("staff_name", req.staffName).eq("venue_id", venueId);
      if (delErr) { console.error("Failed to clear existing zones:", delErr.message); return; }
    }
    const { error: insErr } = await supabase
      .from("staff_zones")
      .upsert({ staff_name: req.staffName, location_id: req.requestedZoneId, venue_id: venueId }, { onConflict: "staff_name,location_id" });
    if (insErr) { console.error("Failed to assign new zone:", insErr.message); return; }

    const { error: updErr } = await supabase
      .from("zone_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    if (!updErr) logAudit("approve_zone_request", "zone_requests", req.id, { staffName: req.staffName, zone: req.requestedZoneId });
    await fetchAll();
  }, [fetchAll, venueId]);

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
      venueId, isPlatformAdmin, venues, chooseVenue, venueResolving,
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
