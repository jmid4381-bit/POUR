"use client";

import { useState, useMemo } from "react";
import {
  Search, ChevronDown, ChevronRight,
  DollarSign, ClipboardList, TrendingUp,
  CheckCircle2, Clock, X, BarChart3, Download,
} from "lucide-react";
import { useStore }     from "@/lib/store";
import { cn, fmtUSD, fmtDateTime, fmtDate, minutesBetween, isToday, isWithinDays } from "@/lib/utils";
import { STATUS_META, type OrderStatus } from "@/lib/types";
import type { Order } from "@/lib/types";

// ─── Date range filter ────────────────────────────────────────────────────────

type DateRange = "today" | "7days" | "30days" | "all";
const DATE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: "today",  label: "Today"    },
  { key: "7days",  label: "7 Days"   },
  { key: "30days", label: "30 Days"  },
  { key: "all",    label: "All Time" },
];

function inRange(iso: string, range: DateRange): boolean {
  if (range === "today")  return isToday(iso);
  if (range === "7days")  return isWithinDays(iso, 7);
  if (range === "30days") return isWithinDays(iso, 30);
  return true;
}

// ─── Status filter ────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{ key: OrderStatus | "all"; label: string }> = [
  { key: "all",       label: "All Orders" },
  { key: "delivered", label: "Delivered"  },
  { key: "pending",   label: "Pending"    },
  { key: "accepted",  label: "Accepted"   },
  { key: "cancelled", label: "Cancelled"  },
];

// ─── Expandable Order Row ─────────────────────────────────────────────────────

function OrderRow({ order, index }: { order: Order; index: number }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[order.status];
  const waitMin = order.deliveredAt
    ? minutesBetween(order.placedAt, order.deliveredAt)
    : null;

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className={cn(
          "border-b border-edge/60 cursor-pointer transition-colors group animate-row-in",
          open ? "bg-raised/70" : "hover:bg-raised/40",
        )}
        style={{ animationDelay: `${index * 20}ms` }}
      >
        {/* ID */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <ChevronRight
              size={13}
              className={cn("text-ink-600 transition-transform flex-shrink-0", open && "rotate-90 text-gold-400")}
            />
            <span className="font-mono text-xs text-ink-400">{order.id}</span>
          </div>
        </td>

        {/* Location */}
        <td className="px-3 py-3.5">
          <p className="text-white text-sm font-body font-medium leading-tight">{order.locationName}</p>
          <p className="text-ink-500 text-xs font-body">{order.section}</p>
          {order.guestName && (
            <p className="text-gold-400/80 text-[11px] font-mono mt-0.5">For {order.guestName}</p>
          )}
        </td>

        {/* Items */}
        <td className="px-3 py-3.5">
          <p className="text-ink-200 text-xs font-body truncate max-w-[180px]">
            {order.items.map(i => `${i.quantity}× ${i.beverageName}`).join(", ")}
          </p>
        </td>

        {/* Status */}
        <td className="px-3 py-3.5">
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border", meta.color)}>
            <span className={cn("w-1 h-1 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        </td>

        {/* Date / Time */}
        <td className="px-3 py-3.5">
          <p className="text-ink-300 text-xs font-mono">{fmtDateTime(order.placedAt)}</p>
          {waitMin !== null && (
            <p className="text-ink-600 text-[10px] font-mono mt-0.5 flex items-center gap-1">
              <Clock size={9} />{waitMin}m delivery
            </p>
          )}
        </td>

        {/* Revenue */}
        <td className="px-4 py-3.5 text-right">
          {order.status === "cancelled" ? (
            <span className="text-ink-600 font-mono text-sm">—</span>
          ) : (
            <span className={cn("font-mono font-semibold text-sm", order.total >= 100 ? "text-gold-300" : "text-white")}>
              {fmtUSD(order.total)}
            </span>
          )}
        </td>
      </tr>

      {/* ── Expanded detail row ── */}
      {open && (
        <tr className="bg-raised/30">
          <td colSpan={6} className="px-6 pb-4 pt-2">
            <div className="rounded-xl border border-edge bg-surface/50 p-4 space-y-3">
              {/* Items breakdown */}
              <div>
                <p className="text-[10px] font-mono text-ink-500 uppercase tracking-widest mb-2">Items</p>
                <div className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-ink-500 w-5 text-right flex-shrink-0">×{item.quantity}</span>
                        <span className="text-ink-200 font-body">{item.beverageName}</span>
                        {item.note && <span className="text-amber-400/70 text-xs font-body italic">"{item.note}"</span>}
                      </div>
                      <span className="font-mono text-ink-300">{fmtUSD(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                {order.surchargeAmount > 0 && (
                  <div className="flex justify-between pt-2 mt-2 border-t border-edge/60">
                    <span className="text-xs font-mono text-amber-400">{order.surchargeLabel ?? "Surcharge"}</span>
                    <span className="font-mono text-amber-300">{fmtUSD(order.surchargeAmount)}</span>
                  </div>
                )}
                <div className={cn("flex justify-between pt-2", order.surchargeAmount > 0 ? "" : "mt-2 border-t border-edge/60")}>
                  <span className="text-xs font-mono text-ink-500">Order Total</span>
                  <span className="font-mono font-bold text-white">{fmtUSD(order.total)}</span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-xs font-mono text-ink-500 pt-1 border-t border-edge/60">
                <span>Placed: {fmtDateTime(order.placedAt)}</span>
                {order.acceptedAt  && <span>Accepted: {fmtDateTime(order.acceptedAt)}</span>}
                {order.deliveredAt && <span>Delivered: {fmtDateTime(order.deliveredAt)}</span>}
                {order.staffName   && <span>Staff: {order.staffName}</span>}
                {order.guestName   && <span className="text-gold-400/80">Guest: {order.guestName}</span>}
                {order.guestNote   && <span className="text-amber-400/80">Note: {order.guestNote}</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Mobile card (replaces the table below the sm: breakpoint) ────────────────
//
// The table uses table-layout: auto, which lets a row grow wider than its
// container when cell content can't shrink below its intrinsic minimum
// width -- on a narrow phone that pushed the table (and the page) wider
// than the viewport, which is what was breaking portrait scrolling. This
// stacks the same fields vertically instead of relying on horizontal space.

function OrderCardMobile({ order, index }: { order: Order; index: number }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[order.status];
  const waitMin = order.deliveredAt
    ? minutesBetween(order.placedAt, order.deliveredAt)
    : null;

  return (
    <div
      className="border-b border-edge/60 animate-row-in"
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors",
          open ? "bg-raised/70" : "active:bg-raised/40",
        )}
      >
        <ChevronRight
          size={13}
          className={cn("text-ink-600 transition-transform flex-shrink-0 mt-1", open && "rotate-90 text-gold-400")}
        />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-ink-400 truncate">{order.id}</span>
            <span className={cn("flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border", meta.color)}>
              <span className={cn("w-1 h-1 rounded-full", meta.dot)} />
              {meta.label}
            </span>
          </div>
          <p className="text-white text-sm font-body font-medium leading-tight truncate">{order.locationName}</p>
          {order.guestName && (
            <p className="text-gold-400/80 text-[11px] font-mono">For {order.guestName}</p>
          )}
          <p className="text-ink-200 text-xs font-body truncate">
            {order.items.map(i => `${i.quantity}× ${i.beverageName}`).join(", ")}
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-ink-500 text-[11px] font-mono">{fmtDateTime(order.placedAt)}</p>
            {order.status === "cancelled" ? (
              <span className="text-ink-600 font-mono text-sm">—</span>
            ) : (
              <span className={cn("font-mono font-semibold text-sm", order.total >= 100 ? "text-gold-300" : "text-white")}>
                {fmtUSD(order.total)}
              </span>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1">
          <div className="rounded-xl border border-edge bg-surface/50 p-4 space-y-3">
            <div>
              <p className="text-[10px] font-mono text-ink-500 uppercase tracking-widest mb-2">Items</p>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-ink-500 w-5 text-right flex-shrink-0">×{item.quantity}</span>
                      <span className="text-ink-200 font-body truncate">{item.beverageName}</span>
                    </div>
                    <span className="font-mono text-ink-300 flex-shrink-0">{fmtUSD(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
              {order.surchargeAmount > 0 && (
                <div className="flex justify-between pt-2 mt-2 border-t border-edge/60">
                  <span className="text-xs font-mono text-amber-400">{order.surchargeLabel ?? "Surcharge"}</span>
                  <span className="font-mono text-amber-300">{fmtUSD(order.surchargeAmount)}</span>
                </div>
              )}
              <div className={cn("flex justify-between pt-2", order.surchargeAmount > 0 ? "" : "mt-2 border-t border-edge/60")}>
                <span className="text-xs font-mono text-ink-500">Order Total</span>
                <span className="font-mono font-bold text-white">{fmtUSD(order.total)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-xs font-mono text-ink-500 pt-1 border-t border-edge/60">
              <span>Placed: {fmtDateTime(order.placedAt)}</span>
              {order.acceptedAt  && <span>Accepted: {fmtDateTime(order.acceptedAt)}</span>}
              {order.deliveredAt && <span>Delivered: {fmtDateTime(order.deliveredAt)}</span>}
              {waitMin !== null  && <span>Delivery time: {waitMin}m</span>}
              {order.staffName   && <span>Staff: {order.staffName}</span>}
              {order.guestName   && <span className="text-gold-400/80">Guest: {order.guestName}</span>}
              {order.guestNote   && <span className="text-amber-400/80">Note: {order.guestNote}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { state, loading } = useStore();

  const [dateRange,     setDateRange]     = useState<DateRange>("30days");
  const [statusFilter,  setStatusFilter]  = useState<OrderStatus | "all">("all");
  const [search,        setSearch]        = useState("");

  const filtered = useMemo(() => {
    return state.orders.filter(o => {
      if (!inRange(o.placedAt, dateRange)) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !o.id.toLowerCase().includes(q) &&
          !o.locationName.toLowerCase().includes(q) &&
          !(o.guestName?.toLowerCase().includes(q)) &&
          !o.items.some(i => i.beverageName.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  }, [state.orders, dateRange, statusFilter, search]);

  // Analytics
  const analytics = useMemo(() => {
    const delivered   = filtered.filter(o => o.status === "delivered");
    const totalRev    = delivered.reduce((s, o) => s + o.total, 0);
    const avgOrderVal = delivered.length ? totalRev / delivered.length : 0;
    const deliveryRate= filtered.length  ? (delivered.length / filtered.filter(o => o.status !== "cancelled").length) * 100 : 0;
    const avgWait     = delivered
      .filter(o => o.deliveredAt)
      .map(o  => minutesBetween(o.placedAt, o.deliveredAt!));
    const avgWaitMin  = avgWait.length ? avgWait.reduce((a, b) => a + b, 0) / avgWait.length : 0;

    return { totalRev, avgOrderVal, deliveryRate, avgWaitMin, deliveredCount: delivered.length };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-ink-500 font-mono text-sm animate-pulse">Loading orders…</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-base/95 backdrop-blur-xl border-b border-edge px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">Order History</h1>
            <p className="text-xs text-ink-500 font-mono mt-0.5">
              {filtered.length} orders · {DATE_OPTIONS.find(d => d.key === dateRange)?.label}
            </p>
          </div>
          <button className="flex items-center gap-1.5 text-xs font-body text-ink-400 hover:text-white border border-edge hover:border-rim bg-surface rounded-xl px-3 py-2 transition-all">
            <Download size={13} />Export CSV
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">

        {/* ── Revenue analytics ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Revenue", value: fmtUSD(analytics.totalRev),        icon: DollarSign,   color: "text-gold-300",  top: "bg-gold-gradient"  },
            { label: "Orders",        value: analytics.deliveredCount,           icon: CheckCircle2, color: "text-felt-400",  top: "bg-felt-gradient"  },
            { label: "Avg Order",     value: fmtUSD(analytics.avgOrderVal),      icon: TrendingUp,   color: "text-gold-400",  top: "bg-gold-gradient"  },
            { label: "Avg Delivery",  value: `${Math.round(analytics.avgWaitMin)}m`, icon: Clock,   color: "text-blue-400",  top: "bg-blue-500"       },
          ].map(({ label, value, icon: Icon, color, top }) => (
            <div key={label} className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
              <div className={cn("h-0.5 w-full", top)} />
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono text-ink-500 uppercase tracking-widest mb-1">{label}</p>
                  <p className={cn("font-mono font-bold text-2xl leading-none", color)}>{value}</p>
                </div>
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-current/10 border border-current/20", color)}>
                  <Icon size={16} className={color} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-3 flex-wrap items-center">
          {/* Date range */}
          <div className="flex bg-surface border border-edge rounded-xl overflow-hidden">
            {DATE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDateRange(key)}
                className={cn(
                  "px-3 py-2 text-xs font-body font-medium transition-all",
                  dateRange === key
                    ? "bg-gold-500/15 text-gold-300"
                    : "text-ink-400 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-body font-medium border transition-all",
                  statusFilter === key
                    ? key === "all"
                      ? "bg-gold-500/10 border-gold-500/20 text-gold-300"
                      : STATUS_META[key].color
                    : "bg-surface border-edge text-ink-400 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by guest name…"
              className="field-input pl-8 w-full text-xs"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-600 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ── Orders — table on tablet/desktop, stacked cards on mobile ── */}
        {filtered.length > 0 ? (
          <>
            {/* Desktop/tablet table */}
            <div className="hidden sm:block rounded-2xl border border-edge overflow-hidden bg-surface shadow-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edge bg-raised/50">
                    {["Order ID", "Location", "Items", "Status", "Date & Time", "Revenue"].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-3 text-[10px] font-mono text-ink-500 uppercase tracking-widest text-left",
                          i === 5 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, i) => (
                    <OrderRow key={order.id} order={order} index={i} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="sm:hidden rounded-2xl border border-edge overflow-hidden bg-surface shadow-card">
              {filtered.map((order, i) => (
                <OrderCardMobile key={order.id} order={order} index={i} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-edge bg-surface shadow-card py-20 text-center">
            <BarChart3 size={32} className="text-ink-700 mx-auto mb-3" />
            <p className="text-ink-500 font-body text-sm">
              {search.trim() ? `No orders found for "${search.trim()}"` : "No orders match your filters"}
            </p>
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); setDateRange("all"); }}
              className="mt-2 text-gold-400 text-xs font-body hover:text-gold-300"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Row count */}
        {filtered.length > 0 && (
          <p className="text-center text-[11px] text-ink-600 font-mono">
            Showing {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Click any row to expand
          </p>
        )}
      </div>
    </>
  );
}
