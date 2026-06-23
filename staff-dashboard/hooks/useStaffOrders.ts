"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { StaffOrder, OrderStatus } from "@/lib/types";
import { OVERDUE_THRESHOLD_MINUTES } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { rowToOrder, type OrderRow } from "@/lib/supabase-orders";
import { logAudit } from "@/lib/audit";
import { isVisibleToStaff } from "@/lib/staffLocations";

// ─── Notification type (Fix 4) ────────────────────────────────────────────────

export interface StaffNotification {
  id:           string;
  orderId:      string;
  locationName: string;
  itemSummary:  string;
  arrivedAt:    Date;
  read:         boolean;
  isPriority:   boolean;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface OrderStats {
  totalActive:    number;
  totalPending:   number;
  totalAccepted:  number;
  totalReady:     number;
  totalDelivered: number;
  overdueCount:   number;
  avgWaitSeconds: number;
}

export function useStaffOrders(staffName = "Staff") {
  const [rawOrders,     setOrders]       = useState<StaffOrder[]>([]);

  // Only orders from this staff member's assigned locations — plus any
  // location nobody has claimed, so an order never goes unseen.
  const orders = useMemo(
    () => rawOrders.filter(o => isVisibleToStaff(o.locationId, staffName)),
    [rawOrders, staffName],
  );
  const [loading,       setLoading]      = useState(true);
  const [loadError,     setLoadError]    = useState<string | null>(null);
  const [newOrderAlert, setNewAlert]     = useState<StaffOrder | null>(null);
  const [notifications, setNotifications]= useState<StaffNotification[]>([]);
  const [actionFeedback,setFeedback]     = useState<{ id: string; msg: string } | null>(null);
  const alertTimer = useRef<NodeJS.Timeout | null>(null);

  // Callback so the page can call markSynced when orders update
  const onOrdersChange = useRef<(() => void) | null>(null);
  const registerSyncCallback = useCallback((fn: () => void) => {
    onOrdersChange.current = fn;
  }, []);

  // Tracks order IDs seen on the previous fetch so a genuinely new arrival
  // can be told apart from "this is just the initial page load." Stays null
  // until the first fetch completes, so nothing fires a false alert on mount.
  const prevOrderIdsRef = useRef<Set<string> | null>(null);

  // ── Fetch orders from Supabase ────────────────────────────────────────────
  // Bounded to the last 24h, plus any order still active regardless of age —
  // staff never need to see week-old delivered orders, but a stuck active
  // order should never silently disappear off the board.
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, section, floor, status, guest_note, is_priority,
        placed_at, accepted_at, ready_at, delivered_at, staff_name, cancel_reason,
        location_id, guest_id, guest_name, location_name,
        order_items ( beverage_name, quantity, note )
      `)
      .or(`placed_at.gte.${since},status.in.(pending,accepted,preparing,ready)`)
      .order("placed_at", { ascending: true });

    if (error) {
      setLoadError(error.message);
    } else {
      setLoadError(null);
      const fetched = (data as OrderRow[]).map(rowToOrder);

      // New-arrival detection — only fires for orders that weren't present
      // on the previous fetch, and never on the very first load.
      if (prevOrderIdsRef.current) {
        const arrivals = fetched.filter(
          o => o.status === "pending" && !prevOrderIdsRef.current!.has(o.id)
        );
        if (arrivals.length > 0) {
          const latest = arrivals.reduce((a, b) =>
            new Date(a.placedAt) > new Date(b.placedAt) ? a : b
          );
          setNewAlert(latest);
          if (alertTimer.current) clearTimeout(alertTimer.current);
          alertTimer.current = setTimeout(() => setNewAlert(null), 8_000);
        }
      }
      prevOrderIdsRef.current = new Set(fetched.map(o => o.id));

      setOrders(fetched);
      onOrdersChange.current?.();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Realtime — refetch when any order or item changes ────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("staff-dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },      () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  // ── Accept ────────────────────────────────────────────────────────────────
  const acceptOrder = useCallback(async (id: string) => {
    const acceptedAt = new Date().toISOString();
    let previous: StaffOrder | undefined;
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      previous = o;
      return { ...o, status: "accepted" as OrderStatus, acceptedAt, staffName };
    }));
    onOrdersChange.current?.();
    showFeedback(id, "Accepted — preparing now");

    const { error } = await supabase
      .from("orders")
      .update({ status: "accepted", accepted_at: acceptedAt, staff_name: staffName.slice(0, 80) })
      .eq("id", id);
    if (error) {
      console.error("Failed to accept order:", error.message);
      if (previous) setOrders(prev => prev.map(o => o.id === id ? previous! : o));
      showFeedback(id, "⚠ Failed to save — reverted");
    } else {
      logAudit("accept_order", "orders", id, { staffName });
    }
  }, [staffName]);

  // ── Mark preparing ────────────────────────────────────────────────────────
  const markPreparing = useCallback(async (id: string) => {
    let previous: StaffOrder | undefined;
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      previous = o;
      return { ...o, status: "preparing" as OrderStatus };
    }));
    onOrdersChange.current?.();
    showFeedback(id, "Now preparing");

    const { error } = await supabase
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", id);
    if (error) {
      console.error("Failed to mark order preparing:", error.message);
      if (previous) setOrders(prev => prev.map(o => o.id === id ? previous! : o));
      showFeedback(id, "⚠ Failed to save — reverted");
    } else {
      logAudit("mark_preparing", "orders", id);
    }
  }, []);

  // ── Mark ready ────────────────────────────────────────────────────────────
  const markReady = useCallback(async (id: string) => {
    const readyAt = new Date().toISOString();
    let previous: StaffOrder | undefined;
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      previous = o;
      return { ...o, status: "ready" as OrderStatus, readyAt };
    }));
    onOrdersChange.current?.();
    showFeedback(id, "Ready for delivery ✓");

    const { error } = await supabase
      .from("orders")
      .update({ status: "ready", ready_at: readyAt })
      .eq("id", id);
    if (error) {
      console.error("Failed to mark order ready:", error.message);
      if (previous) setOrders(prev => prev.map(o => o.id === id ? previous! : o));
      showFeedback(id, "⚠ Failed to save — reverted");
    } else {
      logAudit("mark_ready", "orders", id);
    }
  }, []);

  // ── Deliver ───────────────────────────────────────────────────────────────
  const deliverOrder = useCallback(async (id: string) => {
    const deliveredAt = new Date().toISOString();
    let previous: StaffOrder | undefined;
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      previous = o;
      return { ...o, status: "delivered" as OrderStatus, deliveredAt };
    }));
    onOrdersChange.current?.();
    showFeedback(id, "Delivered ✓");

    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered", delivered_at: deliveredAt })
      .eq("id", id);
    if (error) {
      console.error("Failed to deliver order:", error.message);
      if (previous) setOrders(prev => prev.map(o => o.id === id ? previous! : o));
      showFeedback(id, "⚠ Failed to save — reverted");
    } else {
      logAudit("deliver_order", "orders", id);
    }
  }, []);

  // ── Cancel with reason (Fix 7) ────────────────────────────────────────────
  const cancelOrder = useCallback(async (id: string, reason?: string) => {
    const cancelReason = (reason ?? "No reason given").slice(0, 120);
    let previous: StaffOrder | undefined;
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      previous = o;
      return { ...o, status: "cancelled" as OrderStatus, cancelReason };
    }));
    onOrdersChange.current?.();

    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancel_reason: cancelReason })
      .eq("id", id);
    if (error) {
      console.error("Failed to cancel order:", error.message);
      if (previous) setOrders(prev => prev.map(o => o.id === id ? previous! : o));
      showFeedback(id, "⚠ Failed to save — reverted");
    } else {
      logAudit("cancel_order", "orders", id, { reason: cancelReason });
    }
  }, []);

  // ── Notifications (Fix 4) ─────────────────────────────────────────────────
  const dismissAlert        = useCallback(() => setNewAlert(null), []);
  const markNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const showFeedback = (id: string, msg: string) => {
    setFeedback({ id, msg });
    setTimeout(() => setFeedback(null), 2_500);
  };

  // ── Stats — memoized ──────────────────────────────────────────────────────
  const stats = useMemo((): OrderStats => {
    const now = Date.now();
    let totalDelivered = 0;
    let totalWaitMs    = 0;
    for (const o of orders) {
      if (o.status === "delivered" && o.deliveredAt) {
        totalDelivered++;
        totalWaitMs += new Date(o.deliveredAt).getTime() - new Date(o.placedAt).getTime();
      }
    }
    return {
      totalActive:   orders.filter(o => ["pending","accepted","preparing","ready"].includes(o.status)).length,
      totalPending:  orders.filter(o => o.status === "pending").length,
      totalAccepted: orders.filter(o => o.status === "accepted" || o.status === "preparing").length,
      totalReady:    orders.filter(o => o.status === "ready").length,
      totalDelivered,
      overdueCount:  orders.filter(o => {
        if (o.status !== "pending") return false;
        return (now - new Date(o.placedAt).getTime()) / 60_000 >= OVERDUE_THRESHOLD_MINUTES;
      }).length,
      avgWaitSeconds: totalDelivered > 0
        ? Math.round(totalWaitMs / totalDelivered / 1000)
        : 0,
    };
  }, [orders]);

  return {
    orders, stats,
    loading, loadError,
    newOrderAlert, actionFeedback,
    notifications, unreadCount,
    acceptOrder, markPreparing, markReady, deliverOrder, cancelOrder,
    dismissAlert, markNotificationsRead,
    registerSyncCallback,
    refreshOrders: fetchOrders,
  };
}
