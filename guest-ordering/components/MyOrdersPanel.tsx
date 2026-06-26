"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, AlertCircle, UserRound, RotateCcw, Clock, CheckCircle, Search } from "lucide-react";
import { cn, fmtTime, fmtUSD } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { HistoryOrder } from "@/hooks/useOrderHistory";
import type { QueuedOrderStatus } from "@/lib/queue";

// "1:23" — same shape as the cooldown text shown elsewhere in the app
function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Progress tracker ─────────────────────────────────────────────────────────
// Mirrors OrderConfirmation: advances on elapsed time as well as real status,
// so guests see motion even before staff has acted on the order — whichever
// signal is further along wins.

const STEPS = ["Received", "Preparing", "On the way", "Delivered"];
const STEP_THRESHOLDS = [0, 0.08, 0.65, 0.95];

function statusToStep(status: QueuedOrderStatus): number {
  switch (status) {
    case "pending":   return 0;
    case "accepted":
    case "preparing": return 1;
    case "ready":     return 2;
    case "delivered": return 3;
    default:          return 0;
  }
}

function elapsedToStep(placedAt: string, estimatedMinutes: number): number {
  const elapsed  = (Date.now() - new Date(placedAt).getTime()) / 1000;
  const fraction = elapsed / (estimatedMinutes * 60);
  let step = 0;
  for (let i = STEP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (fraction >= STEP_THRESHOLDS[i]) { step = i; break; }
  }
  return step;
}

interface ProgressTrackerProps {
  status:           QueuedOrderStatus;
  placedAt:         string;
  estimatedMinutes: number;
}

function ProgressTracker({ status, placedAt, estimatedMinutes }: ProgressTrackerProps) {
  const [timeStep, setTimeStep] = useState(() => elapsedToStep(placedAt, estimatedMinutes));

  // Ticks every second (pure local math, no network) so this stays in
  // phase with other views of the same order regardless of when this
  // panel happened to be opened.
  useEffect(() => {
    const tick = () => setTimeStep(elapsedToStep(placedAt, estimatedMinutes));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [placedAt, estimatedMinutes]);

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 mt-3 px-3 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl">
        <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
        <p className="text-red-400 text-xs font-body">This order was cancelled.</p>
      </div>
    );
  }

  // "delivered" means fully complete — including the 4th step itself,
  // which statusToStep alone can never express since it returns the last
  // valid index (3), not "one past the end."
  const currentStep = status === "delivered" ? STEPS.length : Math.max(timeStep, statusToStep(status));
  // currentStep can be STEPS.length (4) to mark every step done — clamp
  // before indexing STEPS with it, or STEPS[4] is undefined and crashes.
  const displayStep = Math.min(currentStep, STEPS.length - 1);

  return (
    <div className="flex items-center mt-3" role="status" aria-label={`Order progress: ${STEPS[displayStep]}`}>
      {STEPS.map((step, i) => {
        const isDone   = i < currentStep;
        const isActive = i === currentStep;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500",
                isDone   ? "bg-felt-grad text-white shadow-btn-felt" :
                isActive ? "border-2 border-felt-500 text-felt-400 animate-pulse-dot" :
                           "bg-lift border border-edge text-mist-600",
              )}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={cn(
                "text-[8px] font-mono uppercase tracking-wide whitespace-nowrap",
                isDone || isActive ? "text-felt-400" : "text-mist-600",
              )}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 mb-4 transition-colors duration-700",
                isDone ? "bg-felt-500/60" : "bg-edge",
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Status badge display ─────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<QueuedOrderStatus, { label: string; color: string }> = {
  pending:   { label: "Waiting",   color: "text-amber-400 bg-amber-400/10 border-amber-400/20"   },
  accepted:  { label: "Accepted",  color: "text-blue-400 bg-blue-400/10 border-blue-400/20"      },
  preparing: { label: "Preparing", color: "text-violet-400 bg-violet-400/10 border-violet-400/20"},
  ready:     { label: "Ready",     color: "text-sky-400 bg-sky-400/10 border-sky-400/20"         },
  delivered: { label: "Delivered", color: "text-felt-400 bg-felt-400/10 border-felt-400/20"      },
  cancelled: { label: "Cancelled", color: "text-mist-500 bg-mist-500/8 border-mist-500/20"       },
};

// ─── Single order card ────────────────────────────────────────────────────────

interface OrderCardProps {
  order:       HistoryOrder;
  cooldownMs:  number;
  onReorder:   (order: HistoryOrder) => void;
}

function OrderCard({ order, cooldownMs, onReorder }: OrderCardProps) {
  const subtotal  = order.items.reduce((s, i) => s + i.beverage.price * i.quantity, 0);
  const surcharge = order.surchargeAmount ?? 0;
  const total     = subtotal + surcharge;
  const display = STATUS_DISPLAY[order.status];
  const isActive = order.status !== "delivered" && order.status !== "cancelled";

  // Only disable the whole button when EVERY item is alcoholic and the
  // guest has zero room left — a mixed order's non-alcoholic items should
  // never be blocked by an alcohol cooldown, so those stay reorderable;
  // addItem() sorts out the alcoholic portion item-by-item on tap instead.
  const isAlcoholOnly = order.items.length > 0 && order.items.every(i => i.beverage.isAlcoholic);
  const blockedByCooldown = isAlcoholOnly && cooldownMs > 0;

  return (
    <div className={cn(
      "bg-card border rounded-2xl overflow-hidden",
      isActive ? "border-gold-500/20" : "border-edge",
    )}>
      {isActive && <div className="h-[2px] bg-gold-grad" />}
      <div className="p-4 space-y-3">

        {/* Order header — ID + time + status badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-white font-semibold">{order.id}</p>
            <p className="text-mist-500 text-[10px] font-mono mt-0.5">{fmtTime(order.placedAt)}</p>
          </div>
          <span className={cn(
            "text-[10px] font-mono px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5",
            display.color,
          )}>
            {display.label}
          </span>
        </div>

        {/* Item list */}
        <div className="space-y-1.5">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm" aria-hidden>{item.beverage.emoji}</span>
                <span className="text-mist-200 font-body text-xs">
                  {item.beverage.name}
                  {item.quantity > 1 && (
                    <span className="text-mist-500 font-mono ml-1">×{item.quantity}</span>
                  )}
                </span>
              </div>
              <span className="font-mono text-mist-500 text-xs">
                {fmtUSD(item.beverage.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {surcharge > 0 && (
          <div className="flex items-center justify-between bg-amber-400/8 border border-amber-400/20 rounded-lg px-2.5 py-1.5">
            <span className="text-amber-300 text-[11px] font-body">{order.surchargeLabel}</span>
            <span className="font-mono text-[11px] font-semibold text-amber-300">{fmtUSD(surcharge)}</span>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between pt-2.5 border-t border-edge/60">
          <span className="text-xs text-mist-500 font-body">Total</span>
          <span className="font-mono text-xs font-semibold text-white">{fmtUSD(total)}</span>
        </div>

        {/* Bartender assignment — only shown once someone has actually claimed it */}
        {order.staffName && isActive && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gold-500/8 border border-gold-500/20 rounded-xl">
            <UserRound size={13} className="text-gold-400 flex-shrink-0" />
            <p className="text-gold-300 text-xs font-body">
              {order.status === "ready"
                ? `${order.staffName} is bringing your order`
                : `${order.staffName} is preparing your order`}
            </p>
          </div>
        )}

        {/* Live progress tracker — collapses to a compact line once delivered,
            since the step-by-step view stops being useful the moment the
            order is actually complete */}
        {order.status === "delivered" ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-felt-400/8 border border-felt-400/20 rounded-xl">
            <CheckCircle size={13} className="text-felt-400 flex-shrink-0" />
            <p className="text-felt-300 text-xs font-body">
              Delivered{order.staffName ? ` · ${order.staffName}` : ""}
            </p>
          </div>
        ) : (
          <ProgressTracker
            status={order.status}
            placedAt={order.placedAt}
            estimatedMinutes={order.estimatedMinutes}
          />
        )}

        {/* Reorder — same items/quantities, added straight to the cart */}
        <button
          onClick={() => onReorder(order)}
          disabled={blockedByCooldown}
          aria-label={blockedByCooldown ? `Reorder unavailable — ${formatCooldown(cooldownMs)} remaining` : `Reorder this order`}
          className={cn(
            "w-full py-2.5 rounded-xl text-xs font-body font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]",
            blockedByCooldown
              ? "bg-lift border border-edge text-mist-600 cursor-not-allowed"
              : "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
          )}
        >
          {blockedByCooldown ? (
            <>
              <Clock size={12} />
              Reorder in {formatCooldown(cooldownMs)}
            </>
          ) : (
            <>
              <RotateCcw size={13} />
              Reorder
            </>
          )}
        </button>

      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface MyOrdersPanelProps {
  orders:     HistoryOrder[];
  onClose:    () => void;
  cooldownMs: number;
  onReorder:  (order: HistoryOrder) => void;
}

export function MyOrdersPanel({ orders, onClose, cooldownMs, onReorder }: MyOrdersPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  const [tab, setTab] = useState<"history" | "summary">("history");
  const [drinkSearch, setDrinkSearch] = useState("");

  // Lock body scroll while panel is open
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeCount = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length;

  // Cancelled orders were never actually charged, so they're excluded from
  // spend — everything else (active or delivered) reflects committed spend.
  const billableOrders = orders.filter(o => o.status !== "cancelled");
  const totalSpend = billableOrders.reduce((sum, o) => {
    const itemsTotal = o.items.reduce((s, i) => s + i.beverage.price * i.quantity, 0);
    return sum + itemsTotal + (o.surchargeAmount ?? 0);
  }, 0);

  // Finds a past drink fast without scrolling through a long day's worth
  // of orders — matches if ANY item in the order shares the typed name,
  // so the whole order (with its existing Reorder button) surfaces.
  const q = drinkSearch.trim().toLowerCase();
  const visibleOrders = q
    ? orders.filter(o => o.items.some(i => i.beverage.name.toLowerCase().includes(q)))
    : orders;
  const visibleBillableOrders = q
    ? billableOrders.filter(o => o.items.some(i => i.beverage.name.toLowerCase().includes(q)))
    : billableOrders;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-void/75 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Bottom sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="My Orders"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-base border-t border-edge rounded-t-3xl shadow-modal animate-sheet-up"
        style={{ maxHeight: "85dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-rim" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-edge flex-shrink-0">
          <div>
            <h2 className="font-display font-semibold text-white text-xl leading-none">My Orders</h2>
            <p className="text-mist-500 text-[11px] font-mono mt-0.5">
              {orders.length} order{orders.length !== 1 ? "s" : ""} this session
              {billableOrders.length > 0 && (
                <span className="text-mist-300"> · {fmtUSD(totalSpend)} total</span>
              )}
              {activeCount > 0 && (
                <span className="ml-2 text-felt-400">· {activeCount} in progress</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close My Orders"
            className="w-8 h-8 rounded-xl bg-lift border border-edge flex items-center justify-center text-mist-400 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab toggle — Order History (detailed, unchanged) vs Summary (condensed) */}
        {orders.length > 0 && (
          <>
            <div className="flex gap-1.5 px-4 pt-3 pb-1 flex-shrink-0">
              {([
                { id: "history", label: "Order History" },
                { id: "summary", label: "Summary" },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-body font-bold transition-all",
                    tab === t.id
                      ? "bg-felt-grad text-white shadow-btn-felt"
                      : "bg-lift border border-edge text-mist-400 hover:text-white",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Find a past drink fast — useful once the list gets long
                enough that scrolling to find one drink is a real chore */}
            <div className="px-4 pt-2.5 pb-1 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
                <input
                  type="text"
                  value={drinkSearch}
                  onChange={e => setDrinkSearch(e.target.value)}
                  placeholder="Search a drink you ordered…"
                  aria-label="Search past orders by drink name"
                  className="w-full bg-lift border border-edge rounded-xl pl-9 pr-9 py-2.5 text-sm text-white font-body placeholder-mist-600 focus:outline-none focus:border-felt-500/40 transition-colors"
                />
                {drinkSearch && (
                  <button
                    onClick={() => setDrinkSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-500 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Order list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          {orders.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3" aria-hidden>🍹</p>
              <p className="text-mist-400 text-sm font-body">No orders yet this session</p>
              <p className="text-mist-600 text-xs font-body mt-1">Your orders will appear here after you place them</p>
            </div>
          ) : q && (tab === "summary" ? visibleBillableOrders : visibleOrders).length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3" aria-hidden>🔍</p>
              <p className="text-mist-400 text-sm font-body">No drinks matching "{drinkSearch.trim()}"</p>
            </div>
          ) : tab === "summary" ? (
            <SummaryView orders={visibleBillableOrders} totalSpend={totalSpend} filterQuery={q} />
          ) : (
            visibleOrders.map(order => (
              <OrderCard key={order.id} order={order} cooldownMs={cooldownMs} onReorder={onReorder} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Summary view ───────────────────────────────────────────────────────────

interface SummaryViewProps {
  orders:      HistoryOrder[];
  totalSpend:  number;
  filterQuery?: string; // lowercased drink-name search — narrows rows shown
}

function SummaryView({ orders, totalSpend, filterQuery }: SummaryViewProps) {
  const drinkMap = new Map<string, { name: string; emoji: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const cur = drinkMap.get(item.beverage.id) ?? {
        name: item.beverage.name,
        emoji: item.beverage.emoji,
        quantity: 0,
        revenue: 0,
      };
      drinkMap.set(item.beverage.id, {
        ...cur,
        quantity: cur.quantity + item.quantity,
        revenue:  cur.revenue + item.beverage.price * item.quantity,
      });
    }
  }
  let drinks = [...drinkMap.values()].sort((a, b) => b.revenue - a.revenue);
  if (filterQuery) {
    drinks = drinks.filter(d => d.name.toLowerCase().includes(filterQuery));
  }

  const surchargeOrders = orders.filter(o => (o.surchargeAmount ?? 0) > 0);
  const surchargeTotal  = surchargeOrders.reduce((s, o) => s + (o.surchargeAmount ?? 0), 0);
  const surchargeLabel  = surchargeOrders[0]?.surchargeLabel ?? "Event Surcharge";

  return (
    <div className="flex flex-col min-h-[60vh] bg-card border border-edge rounded-2xl overflow-hidden shadow-card">
      <div className="h-[3px] bg-gold-grad flex-shrink-0" />
      <div className="flex-1 flex flex-col p-5 sm:p-6">
        <div className="flex-1 space-y-4">
          {drinks.map(d => (
            <div key={d.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl flex-shrink-0" aria-hidden>{d.emoji}</span>
                <span className="text-mist-100 font-body text-base truncate">
                  <span className="font-mono text-mist-400">{d.quantity}×</span> {d.name}
                </span>
              </div>
              <span className="font-mono text-base text-white font-semibold flex-shrink-0">{fmtUSD(d.revenue)}</span>
            </div>
          ))}

          {surchargeTotal > 0 && (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-edge/60">
              <span className="text-amber-400 font-body text-sm truncate">
                {surchargeLabel}{surchargeOrders.length > 1 ? ` ×${surchargeOrders.length} orders` : ""}
              </span>
              <span className="font-mono text-sm text-amber-300 font-semibold flex-shrink-0">{fmtUSD(surchargeTotal)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-edge flex-shrink-0">
          <span className="text-mist-300 font-body text-lg font-semibold">Total</span>
          <span className="font-mono text-2xl text-white font-bold">{fmtUSD(totalSpend)}</span>
        </div>
      </div>
    </div>
  );
}
