"use client";

import { useState } from "react";
import {
  MapPin, Clock, AlertTriangle, CheckCircle2,
  Truck, X, ChevronDown, ChevronUp, Star, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveTimer } from "./LiveTimer";
import { STATUS_META, OVERDUE_THRESHOLD_MINUTES } from "@/lib/types";
import type { StaffOrder } from "@/lib/types";

interface OrderCardProps {
  order: StaffOrder;
  onAccept:  (id: string) => void;
  onDeliver: (id: string) => void;
  onCancel:  (id: string) => void;
  feedback?: string;
  animationDelay?: number;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York",
  });
}

export function OrderCard({
  order, onAccept, onDeliver, onCancel, feedback, animationDelay = 0,
}: OrderCardProps) {
  const [expanded,    setExpanded]    = useState(order.status === "pending");
  const [accepting,   setAccepting]   = useState(false);
  const [delivering,  setDelivering]  = useState(false);
  const [cancelling,  setCancelling]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const meta = STATUS_META[order.status];
  const waitMins = (Date.now() - new Date(order.placedAt).getTime()) / 60_000;
  const isOverdue = order.status === "pending" && waitMins >= OVERDUE_THRESHOLD_MINUTES;

  const handleAccept = async () => {
    setAccepting(true);
    await new Promise(r => setTimeout(r, 500));
    onAccept(order.id);
    setAccepting(false);
    setExpanded(true);
  };

  const handleDeliver = async () => {
    setDelivering(true);
    await new Promise(r => setTimeout(r, 500));
    onDeliver(order.id);
    setDelivering(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    await new Promise(r => setTimeout(r, 300));
    onCancel(order.id);
    setCancelling(false);
    setShowConfirm(false);
  };

  // Status left border color
  const borderAccent =
    isOverdue               ? "border-l-red-500"     :
    order.status === "pending"   ? "border-l-amber-400"  :
    order.status === "accepted"  ? "border-l-blue-400"   :
    order.status === "delivered" ? "border-l-emerald-500":
    "border-l-slate-600";

  // Card background glow
  const bgGlow =
    isOverdue               ? "bg-grad-overdue"  :
    order.status === "pending"   ? "bg-grad-pending"  :
    order.status === "accepted"  ? "bg-grad-active"   :
    order.status === "delivered" ? "bg-grad-delivered":
    "";

  return (
    <article
      className={cn(
        "relative rounded-2xl bg-surface border border-border border-l-[3px] overflow-hidden",
        "shadow-card transition-all duration-300 animate-fade-up",
        borderAccent,
        isOverdue && "shadow-overdue-glow",
        order.status === "accepted" && "shadow-active-glow",
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Background glow overlay */}
      <div className={cn("absolute inset-0 pointer-events-none", bgGlow)} />

      {/* Priority ribbon */}
      {order.isPriority && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="absolute top-0 right-0 overflow-hidden w-14 h-14 z-10">
          <div className="bg-gold-grad text-void text-[8px] font-bold uppercase tracking-wider text-center py-0.5 rotate-45 translate-x-3 translate-y-2.5 w-14 shadow">
            VIP
          </div>
        </div>
      )}

      {/* ── Card Header ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 pt-4 pb-3 relative z-10"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: order ID + location */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[11px] text-slate-400 tracking-wider">{order.id}</span>
              {/* Status badge */}
              <span className={cn(
                "inline-flex items-center gap-1 text-2xs font-mono font-semibold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                meta.color, meta.bg, meta.border,
              )}>
                {order.status === "pending" && isOverdue
                  ? <><AlertTriangle size={9} />Overdue</>
                  : meta.label
                }
              </span>
              {order.isPriority && (
                <span className="inline-flex items-center gap-0.5 text-2xs font-mono text-gold-400 bg-gold-500/10 border border-gold-500/20 rounded-full px-1.5 py-0.5">
                  <Star size={8} className="fill-gold-400" />VIP
                </span>
              )}
            </div>

            <div className="flex items-start gap-1.5">
              <MapPin size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-white font-display font-semibold text-base leading-tight">
                {order.locationName}
              </p>
            </div>
            <p className="text-slate-400 text-xs font-body mt-0.5 ml-[18px]">
              {order.section} · Floor {order.floor}
            </p>
          </div>

          {/* Right: timer + expand */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <LiveTimer placedAt={order.placedAt} status={order.status} />
            <div className="flex items-center gap-1 text-slate-400">
              <Clock size={10} />
              <span className="text-2xs font-mono">{fmtTime(order.placedAt)}</span>
            </div>
            {expanded
              ? <ChevronUp size={14} className="text-slate-400" />
              : <ChevronDown size={14} className="text-slate-400" />
            }
          </div>
        </div>

        {/* Items preview (collapsed) */}
        {!expanded && (
          <p className="text-slate-400 text-xs font-body mt-2 ml-[18px] line-clamp-1">
            {order.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
          </p>
        )}
      </button>

      {/* ── Expanded Content ── */}
      {expanded && (
        <div className="px-4 pb-4 relative z-10 border-t border-border/60 pt-3 space-y-4">

          {/* Items list */}
          <div>
            <p className="text-2xs font-mono text-slate-400 uppercase tracking-widest mb-2">
              Order Items
            </p>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 bg-raised/60 border border-border/60 rounded-xl px-3 py-2.5"
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="font-mono text-xs text-slate-400 mt-0.5 flex-shrink-0">
                      ×{item.qty}
                    </span>
                    <div>
                      <p className="text-white text-sm font-body font-medium leading-tight">
                        {item.name}
                      </p>
                      {item.note && (
                        <p className="text-amber-400/80 text-[11px] font-body mt-0.5 italic">
                          "{item.note}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guest note */}
          {order.guestNote && (
            <div className="flex items-start gap-2 bg-amber-400/5 border border-amber-400/15 rounded-xl px-3 py-2.5">
              <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/90 text-xs font-body leading-relaxed">
                {order.guestNote}
              </p>
            </div>
          )}

          {/* Staff info (if accepted/delivered) */}
          {order.staffName && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-body">
              <User size={11} />
              <span>Handled by <strong className="text-slate-300">{order.staffName}</strong></span>
              {order.acceptedAt && (
                <span>· Accepted {fmtTime(order.acceptedAt)}</span>
              )}
              {order.deliveredAt && (
                <span>· Delivered {fmtTime(order.deliveredAt)}</span>
              )}
            </div>
          )}

          {/* ── Action Buttons ── */}
          {order.status === "pending" && !showConfirm && (
            <div className="flex gap-2 pt-1">
              {/* Accept Order */}
              <button
                onClick={handleAccept}
                disabled={accepting}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                  "font-body font-bold text-sm transition-all duration-200 active:scale-[0.97]",
                  "bg-emerald-500 hover:bg-emerald-400 text-white shadow-btn-accept",
                  accepting && "opacity-70 cursor-wait",
                )}
              >
                {accepting
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <CheckCircle2 size={16} />
                }
                {accepting ? "Accepting…" : "Accept Order"}
              </button>

              {/* Cancel trigger */}
              <button
                onClick={() => setShowConfirm(true)}
                className="w-11 h-11 rounded-xl bg-raised border border-border flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {order.status === "accepted" && !showConfirm && (
            <div className="flex gap-2 pt-1">
              {/* Mark Delivered */}
              <button
                onClick={handleDeliver}
                disabled={delivering}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                  "font-body font-bold text-sm transition-all duration-200 active:scale-[0.97]",
                  "bg-blue-500 hover:bg-blue-400 text-white shadow-btn-deliver",
                  delivering && "opacity-70 cursor-wait",
                )}
              >
                {delivering
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Truck size={16} />
                }
                {delivering ? "Marking…" : "Mark Delivered"}
              </button>

              <button
                onClick={() => setShowConfirm(true)}
                className="w-11 h-11 rounded-xl bg-raised border border-border flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Cancel confirmation */}
          {showConfirm && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 animate-fade-in">
              <p className="text-sm text-red-300 font-body mb-3">
                Cancel this order? The guest will not be notified.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm font-body font-bold transition-all active:scale-95"
                >
                  {cancelling ? "Cancelling…" : "Yes, Cancel"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-raised border border-border text-slate-300 text-sm font-body transition-all hover:bg-rim active:scale-95"
                >
                  Keep Order
                </button>
              </div>
            </div>
          )}

          {/* Feedback flash */}
          {feedback && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 animate-fade-in">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span className="text-xs text-emerald-300 font-body">{feedback}</span>
            </div>
          )}

          {/* Delivered summary */}
          {order.status === "delivered" && (
            <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-xs text-emerald-300/80 font-body">
                Delivered at {order.deliveredAt ? fmtTime(order.deliveredAt) : "—"}
                {order.staffName && ` by ${order.staffName}`}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
