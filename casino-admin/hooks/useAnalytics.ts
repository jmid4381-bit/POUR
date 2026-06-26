"use client";

/**
 * useAnalytics — single memoized source of truth for all dashboard metrics.
 *
 * Every page and component reads from this hook. Analytics are computed
 * once per state change rather than recalculated in each component.
 * When Supabase replaces the store, only this file needs to change.
 */

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { minutesBetween, isToday, isWithinDays } from "@/lib/utils";
import type { BeverageCategory } from "@/lib/types";

// ─── Exported types ───────────────────────────────────────────────────────────

export interface StaffStat {
  name:    string;
  orders:  number;
  revenue: number;
  avgWait: number;     // minutes
}

export interface ItemStat {
  id:      string;
  name:    string;
  emoji:   string;
  revenue: number;
  count:   number;
  category:BeverageCategory;
}

export interface DayStat {
  label:   string;   // "Mon", "Today", etc.
  revenue: number;
  orders:  number;
}

export interface SectionStat {
  section:   string;
  floor:     number;
  orders:    number;
  revenue:   number;
  activeNow: number;
}

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface AlertItem {
  id:       string;
  type:     "overdue" | "priority" | "cancelled" | "system";
  message:  string;
  severity: AlertSeverity;
  orderId?: string;
  since?:   string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalytics() {
  const { state } = useStore();
  const { orders, beverages } = state;

  return useMemo(() => {
    const now = Date.now();

    // ── Segment orders ────────────────────────────────────────────────────
    const allDelivered  = orders.filter(o => o.status === "delivered");
    const todayAll      = orders.filter(o => isToday(o.placedAt));
    const todayDelivered= todayAll.filter(o => o.status === "delivered");
    const todayCancelled= todayAll.filter(o => o.status === "cancelled");
    const activeOrders  = orders.filter(o => ["pending","accepted","preparing","ready"].includes(o.status));
    const pendingOrders = orders.filter(o => o.status === "pending");
    const preparingOrders=orders.filter(o => ["accepted","preparing"].includes(o.status));
    const readyOrders   = orders.filter(o => o.status === "ready");

    // ── Overdue: pending > 10 min ─────────────────────────────────────────
    const overdueOrders = pendingOrders.filter(o =>
      (now - new Date(o.placedAt).getTime()) / 60_000 >= 10
    );

    // ── KPI figures ───────────────────────────────────────────────────────
    // Order-level totals (includes any surcharge) — what guests actually paid.
    const todayRevenue  = todayDelivered.reduce((s, o) => s + o.total, 0);
    const weekRevenue   = orders
      .filter(o => o.status === "delivered" && isWithinDays(o.placedAt, 7))
      .reduce((s, o) => s + o.total, 0);
    const monthRevenue  = orders
      .filter(o => o.status === "delivered" && isWithinDays(o.placedAt, 30))
      .reduce((s, o) => s + o.total, 0);
    const avgOrderValue = allDelivered.length
      ? allDelivered.reduce((s,o) => s+o.total, 0) / allDelivered.length
      : 0;

    // Avg wait today
    const todayWaits = todayDelivered
      .filter(o => o.deliveredAt)
      .map(o => minutesBetween(o.placedAt, o.deliveredAt!));
    const avgWaitMinutes = todayWaits.length
      ? Math.round(todayWaits.reduce((a,b) => a+b, 0) / todayWaits.length)
      : 0;

    // ── Revenue by day — last 7 ───────────────────────────────────────────
    const revenueByDay: DayStat[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000);
      const dayOrders = allDelivered.filter(o => {
        const od = new Date(o.placedAt);
        return od.getFullYear() === d.getFullYear()
            && od.getMonth()    === d.getMonth()
            && od.getDate()     === d.getDate();
      });
      revenueByDay.push({
        label:   i === 0 ? "Today" : i === 1 ? "Yest" : d.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: dayOrders.reduce((s,o) => s+o.total, 0),
        orders:  dayOrders.length,
      });
    }

    // ── Top items by revenue ──────────────────────────────────────────────
    const itemMap = new Map<string, ItemStat>();
    for (const order of allDelivered) {
      for (const item of order.items) {
        const bev = beverages.find(b => b.id === item.beverageId);
        const cur = itemMap.get(item.beverageId) ?? {
          id: item.beverageId,
          name: item.beverageName,
          emoji: bev?.emoji ?? "🍹",
          category: bev?.category ?? "cocktail",
          revenue: 0, count: 0,
        };
        itemMap.set(item.beverageId, {
          ...cur,
          revenue: cur.revenue + item.unitPrice * item.quantity,
          count:   cur.count   + item.quantity,
        });
      }
    }
    const topItems = [...itemMap.values()]
      .sort((a,b) => b.revenue - a.revenue)
      .slice(0, 6);

    // ── Category breakdown ────────────────────────────────────────────────
    const catMap = new Map<string, { revenue: number; orders: number }>();
    for (const order of allDelivered) {
      for (const item of order.items) {
        const bev = beverages.find(b => b.id === item.beverageId);
        if (!bev) continue;
        const cur = catMap.get(bev.category) ?? { revenue: 0, orders: 0 };
        catMap.set(bev.category, {
          revenue: cur.revenue + item.unitPrice * item.quantity,
          orders:  cur.orders  + item.quantity,
        });
      }
    }
    const categoryBreakdown = [...catMap.entries()]
      .map(([category, stat]) => ({ category: category as BeverageCategory, ...stat }))
      .sort((a,b) => b.revenue - a.revenue);

    // ── Staff performance ─────────────────────────────────────────────────
    const staffMap = new Map<string, { orders:number; revenue:number; totalWait:number; waitCount:number }>();
    for (const order of allDelivered) {
      if (!order.staffName) continue;
      const cur = staffMap.get(order.staffName) ?? { orders:0, revenue:0, totalWait:0, waitCount:0 };
      const wait = order.deliveredAt ? minutesBetween(order.placedAt, order.deliveredAt) : 0;
      staffMap.set(order.staffName, {
        orders:    cur.orders + 1,
        revenue:   cur.revenue + order.total,
        totalWait: cur.totalWait + wait,
        waitCount: cur.waitCount + (order.deliveredAt ? 1 : 0),
      });
    }
    const staffPerformance: StaffStat[] = [...staffMap.entries()]
      .map(([name, s]) => ({
        name,
        orders:  s.orders,
        revenue: s.revenue,
        avgWait: s.waitCount ? Math.round(s.totalWait / s.waitCount) : 0,
      }))
      .sort((a,b) => b.revenue - a.revenue);

    // ── Section activity ──────────────────────────────────────────────────
    const secMap = new Map<string, SectionStat>();
    for (const order of orders) {
      const cur = secMap.get(order.section) ?? { section:order.section, floor:order.floor, orders:0, revenue:0, activeNow:0 };
      secMap.set(order.section, {
        ...cur,
        orders:    cur.orders + 1,
        revenue:   cur.revenue + order.total,
        activeNow: cur.activeNow + (["pending","accepted","preparing","ready"].includes(order.status) ? 1 : 0),
      });
    }
    const sectionActivity = [...secMap.values()]
      .sort((a,b) => b.activeNow - a.activeNow || b.orders - a.orders);

    // ── Alerts ────────────────────────────────────────────────────────────
    const alerts: AlertItem[] = [];

    for (const order of overdueOrders) {
      const mins = Math.floor((now - new Date(order.placedAt).getTime()) / 60_000);
      alerts.push({
        id: `overdue-${order.id}`,
        type: "overdue",
        message: `${order.locationName} waiting ${mins} min — no staff assigned`,
        severity: mins >= 15 ? "critical" : "high",
        orderId: order.id,
        since: order.placedAt,
      });
    }
    // High-value active orders
    for (const order of activeOrders) {
      if (order.total >= 150) {
        alerts.push({
          id: `vip-${order.id}`,
          type: "priority",
          message: `VIP order $${order.total} active at ${order.locationName}`,
          severity: "medium",
          orderId: order.id,
        });
      }
    }
    if (todayCancelled.length >= 2) {
      alerts.push({
        id: "cancels",
        type: "cancelled",
        message: `${todayCancelled.length} cancellations today — review with floor team`,
        severity: "low",
      });
    }

    // ── Recent activity feed ──────────────────────────────────────────────
    const recentActivity = [...orders]
      .sort((a,b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
      .slice(0, 12);

    // ── Summary counts ─────────────────────────────────────────────────────
    return {
      // Live counts
      activeOrderCount:  activeOrders.length,
      pendingCount:      pendingOrders.length,
      preparingCount:    preparingOrders.length,
      readyCount:        readyOrders.length,
      overdueCount:      overdueOrders.length,
      activeOrders,
      overdueOrders,

      // Today
      todayRevenue,
      todayOrderCount:   todayAll.length,
      deliveredToday:    todayDelivered.length,
      cancelledToday:    todayCancelled.length,
      avgWaitMinutes,

      // Trends
      weekRevenue,
      monthRevenue,
      avgOrderValue:     Math.round(avgOrderValue),

      // Analytics
      revenueByDay,
      topItems,
      categoryBreakdown,

      // People
      staffPerformance,

      // Locations
      sectionActivity,

      // Feed + alerts
      recentActivity,
      alerts,
      criticalAlertCount: alerts.filter(a => a.severity === "critical" || a.severity === "high").length,
    };
  }, [orders, beverages]);
}
