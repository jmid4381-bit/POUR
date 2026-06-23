"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { readOrderStatus, readOrderStaffName, type QueuedOrderStatus } from "@/lib/queue";
import type { CartItem } from "@/lib/data";

export interface HistoryOrder {
  id:               string;
  locationName:     string;
  items:            CartItem[];
  estimatedMinutes: number;
  placedAt:         string;
  status:           QueuedOrderStatus;
  staffName?:       string;
}

const HISTORY_KEY_PREFIX = "casino_orders_v1_";

function historyKey(locationId: string): string {
  return `${HISTORY_KEY_PREFIX}${locationId}`;
}

function loadHistory(locationId: string): HistoryOrder[] {
  try {
    const raw = sessionStorage.getItem(historyKey(locationId));
    return raw ? (JSON.parse(raw) as HistoryOrder[]) : [];
  } catch { return []; }
}

function saveHistory(locationId: string, orders: HistoryOrder[]): void {
  try {
    sessionStorage.setItem(historyKey(locationId), JSON.stringify(orders));
  } catch { /* quota or SSR */ }
}

function isTerminal(status: QueuedOrderStatus): boolean {
  return status === "delivered" || status === "cancelled";
}

export function useOrderHistory(locationId: string) {
  const [orders,   setOrders]   = useState<HistoryOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const ordersRef = useRef<HistoryOrder[]>([]);

  // Keep ref in sync so the poll interval can read current state without
  // needing to be recreated on every status change
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    setOrders(loadHistory(locationId));
    setHydrated(true);
  }, [locationId]);

  // Persist on every change (after hydration to avoid overwriting with [])
  useEffect(() => {
    if (!hydrated) return;
    saveHistory(locationId, orders);
  }, [orders, locationId, hydrated]);

  // Poll active orders — same 10s cadence as the confirmation screen, so
  // status never feels more stale in one view than the other.
  const poll = useCallback(async () => {
    const active = ordersRef.current.filter(o => !isTerminal(o.status));
    if (active.length === 0) return;

    const updates = await Promise.all(
      active.map(async o => {
        const [status, staffName] = await Promise.all([
          readOrderStatus(o.id),
          readOrderStaffName(o.id),
        ]);
        return { id: o.id, status, staffName };
      })
    );

    setOrders(prev => {
      let changed = false;
      const next = prev.map(o => {
        const u = updates.find(x => x.id === o.id);
        if (!u) return o;
        if (u.status !== o.status || (u.staffName && u.staffName !== o.staffName)) {
          changed = true;
          return { ...o, status: u.status, staffName: u.staffName ?? o.staffName };
        }
        return o;
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    poll();
    const id = setInterval(poll, 5_000);
    return () => clearInterval(id);
  }, [hydrated, poll]);

  const addOrder = useCallback((order: Omit<HistoryOrder, "status">) => {
    setOrders(prev => [{ ...order, status: "pending" }, ...prev]);
  }, []);

  const activeCount = orders.filter(o => !isTerminal(o.status)).length;

  return { orders, addOrder, activeCount, refreshNow: poll };
}
