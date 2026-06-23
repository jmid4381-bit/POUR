"use client";

/**
 * KanbanColumn — Fix 3: delivered column is capped at 20 recent entries
 * to prevent the DOM growing unbounded over a busy shift.
 *
 * Shows "X more not displayed" footer when orders exceed the cap so
 * staff know the full count without seeing all records rendered.
 */

import { cn } from "@/lib/utils";
import { KanbanCard } from "./KanbanCard";
import type { StaffOrder } from "@/lib/types";

const DELIVERED_CAP = 20;

interface KanbanColumnProps {
  title:       string;
  status:      string;
  orders:      StaffOrder[];
  count:       number;
  accentColor: string;
  headerBg:    string;
  emptyLabel:  string;
  onAccept:    (id: string) => void;
  onReady:     (id: string) => void;
  onDeliver:   (id: string) => void;
  onCancel:    (id: string, reason: string) => void;
  feedback?:   { id: string; msg: string } | null;
  isActive?:   boolean;  // mobile single-column mode
  newOrderId?: string | null; // briefly highlights the card that just arrived
  guestCooldowns?: Map<string, number>; // guestId -> cooldown expiry (epoch ms)
}

export function KanbanColumn({
  title, status, orders, count, accentColor, headerBg, emptyLabel,
  onAccept, onReady, onDeliver, onCancel, feedback, newOrderId, guestCooldowns,
}: KanbanColumnProps) {
  const isDelivered = status === "delivered";
  const isNew       = status === "pending";
  const hasOrders   = orders.length > 0;

  // Fix 3 — cap delivered column; others show all.
  // The incoming `orders` array is sorted oldest-first (for the other
  // columns, where that doesn't matter much). For Delivered specifically,
  // most-recently-finished should be on top — and the cap should keep the
  // most recent N, not the oldest N, which a plain slice(0, N) would do on
  // an oldest-first list.
  const visibleOrders = isDelivered
    ? [...orders]
        .sort((a, b) => new Date(b.deliveredAt ?? b.placedAt).getTime() - new Date(a.deliveredAt ?? a.placedAt).getTime())
        .slice(0, DELIVERED_CAP)
    : orders;
  const hiddenCount   = isDelivered ? Math.max(0, orders.length - DELIVERED_CAP) : 0;

  const statusDotClass =
    isNew && hasOrders           ? "bg-amber-400 animate-ping-slow" :
    status === "accepted"        ? "bg-blue-400"   :
    status === "ready"           ? "bg-violet-400" :
    status === "delivered"       ? "bg-emerald-400":
    "bg-slate-600";

  return (
    <div className={cn(
      "flex flex-col min-w-0 flex-1 min-h-0",
      "bg-void/40 border border-border rounded-2xl overflow-hidden",
      isNew && hasOrders && "border-amber-400/15",
    )}>

      {/* Column header */}
      <div className={cn(
        "flex items-center justify-between px-3.5 py-2.5 border-b border-border flex-shrink-0",
        headerBg,
      )}>
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusDotClass)} />
          <h2 className={cn(
            "font-display font-bold text-xs uppercase tracking-widest",
            accentColor,
          )}>
            {title}
          </h2>
        </div>
        <span className={cn(
          "font-mono font-bold text-sm min-w-[24px] h-6 rounded-lg flex items-center justify-center px-2",
          count > 0
            ? `${accentColor} bg-white/8 border border-white/10`
            : "text-slate-600 bg-surface border border-border",
        )}>
          {count}
        </span>
      </div>

      {/* Scrollable cards — Fix 8: flex-1 + min-h-0 replaces magic-number calc() */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-2.5 space-y-2.5">
        {hasOrders ? (
          <>
            {visibleOrders.map(order => (
              <KanbanCard
                key={order.id}
                order={order}
                onAccept={onAccept}
                onReady={onReady}
                onDeliver={onDeliver}
                onCancel={onCancel}
                feedback={feedback?.id === order.id ? feedback.msg : undefined}
                isNewArrival={order.id === newOrderId}
                cooldownExpiry={order.guestId ? guestCooldowns?.get(order.guestId) : undefined}
              />
            ))}

            {/* Fix 3 — overflow notice */}
            {hiddenCount > 0 && (
              <div className="text-center py-3 border border-border/40 rounded-xl bg-raised/30">
                <p className="text-[11px] font-mono text-slate-600">
                  {hiddenCount} older record{hiddenCount !== 1 ? "s" : ""} not shown
                </p>
                <p className="text-[10px] text-slate-700 font-body mt-0.5">
                  View full history in the reports tab
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center mb-2.5">
              <span className="text-slate-600 text-lg">—</span>
            </div>
            <p className="text-slate-600 text-xs font-body">{emptyLabel}</p>
          </div>
        )}
      </div>

    </div>
  );
}
