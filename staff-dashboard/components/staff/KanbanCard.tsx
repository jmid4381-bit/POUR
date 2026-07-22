"use client";

/**
 * KanbanCard — always-expanded order card for the kanban board.
 *
 * Integrates:
 *  Fix 5  — graduated urgency (border + background escalate caution→urgent→overdue)
 *  Fix 7  — cancel opens CancelReasonModal, not a plain confirm
 *  Fix 10 — ZoneBadge for instant location identification
 */

import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, Truck,
  Star, User, Clock, Package, Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveTimer } from "./LiveTimer";
import { ZoneBadge } from "./ZoneBadge";
import { CancelReasonModal, type CancelReasonId } from "./CancelReasonModal";
import { getUrgency, URGENCY_CLASSES } from "@/lib/types";
import type { StaffOrder } from "@/lib/types";
import { useClock } from "@/contexts/ClockContext";

interface KanbanCardProps {
  order:           StaffOrder;
  onAccept:        (id: string) => void;
  onReady:         (id: string) => void;
  onDeliver:       (id: string) => void;
  onCancel:        (id: string, reason: string) => void;
  onConfirmDelivered?: (id: string) => void;
  feedback?:       string;
  isNewArrival?:   boolean; // briefly highlighted when it just arrived via realtime
  cooldownExpiry?: number;  // epoch ms when this guest's alcohol cooldown clears
  isOutsideZone?:  boolean; // surfaced only via cross-location name search
}

// "2m 15s" / "45s" — same shape as the existing toast/header cooldown text
function fmtRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York",
  });
}

export function KanbanCard({
  order, onAccept, onReady, onDeliver, onCancel, onConfirmDelivered, feedback, isNewArrival, cooldownExpiry, isOutsideZone,
}: KanbanCardProps) {
  const [showCancelDlg,setShowCancelDlg]= useState(false);

  // Live countdown rides the shared ClockContext tick — no per-card interval.
  const nowSec = useClock();
  const cooldownRemainingMs = cooldownExpiry ? Math.max(0, cooldownExpiry - nowSec * 1000) : 0;
  const showCooldown = cooldownRemainingMs > 0;

  const urgency     = getUrgency(order.placedAt, order.status);
  const urgencyCls  = URGENCY_CLASSES[urgency];
  const totalItems  = order.items.reduce((s, i) => s + i.qty, 0);

  // Card border — escalates with urgency
  const borderColor =
    urgency === "overdue"        ? "border-l-red-500"      :
    urgency === "urgent"         ? "border-l-orange-400"   :
    urgency === "caution"        ? "border-l-amber-400"    :
    order.status === "pending"   ? "border-l-amber-400/50" :
    order.status === "accepted"  ? "border-l-blue-400"     :
    order.status === "preparing" ? "border-l-blue-400"     :
    order.status === "ready"     ? "border-l-violet-400"   :
    order.status === "delivered" ? "border-l-emerald-500"  :
    "border-l-slate-600";

  const bgOverlay =
    urgency === "overdue"        ? "bg-grad-overdue"   :
    urgency === "urgent"         ? "bg-grad-overdue/60":
    order.status === "pending"   ? "bg-grad-pending"   :
    order.status === "accepted"  ? "bg-grad-active"    :
    order.status === "preparing" ? "bg-grad-active"    :
    order.status === "ready"     ? "bg-grad-ready"     :
    order.status === "delivered" ? "bg-grad-delivered" :
    "";

  const cardGlow =
    urgency === "overdue"        ? "shadow-overdue-glow"  :
    urgency === "urgent"         ? "shadow-[0_0_0_1px_rgba(249,115,22,0.25),0_4px_20px_rgba(249,115,22,0.10)]" :
    order.status === "accepted"  ? "shadow-active-glow"   :
    order.status === "preparing" ? "shadow-active-glow"   :
    order.status === "ready"     ? "shadow-ready-glow"    :
    "";

  const handleCancelConfirm = (_reasonId: CancelReasonId, fullReason: string) => {
    onCancel(order.id, fullReason);
    setShowCancelDlg(false);
  };

  return (
    <>
      <article className={cn(
        "relative rounded-xl bg-surface border border-border border-l-[3px] overflow-hidden",
        "shadow-card transition-all duration-200",
        borderColor, cardGlow,
        isNewArrival && "animate-count-in ring-2 ring-amber-400/60 shadow-pending-glow",
      )}>
        {/* Background urgency tint */}
        <div className={cn("absolute inset-0 pointer-events-none opacity-70", bgOverlay)} />

        {/* VIP corner ribbon */}
        {order.isPriority && order.status !== "delivered" && (
          <div className="absolute top-0 right-0 overflow-hidden w-12 h-12 z-10">
            <div className="bg-gold-grad text-void text-[7px] font-bold uppercase tracking-wider text-center py-0.5 rotate-45 translate-x-2 translate-y-2.5 w-12 shadow">
              VIP
            </div>
          </div>
        )}

        <div className="relative z-10 p-3 space-y-2.5">

          {/* ── Row 1: ID + timer ── */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-mono text-[11px] text-slate-400 tracking-wide">{order.id}</span>
              {order.isPriority && (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-mono text-gold-400 bg-gold-500/10 border border-gold-500/20 rounded-full px-1.5 py-0.5">
                  <Star size={7} className="fill-gold-400" />VIP
                </span>
              )}
              {/* Urgency label for caution+ */}
              {urgency !== "fresh" && order.status === "pending" && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider",
                  urgencyCls.text, urgencyCls.bg, urgencyCls.border,
                )}>
                  <AlertTriangle size={7} />
                  {urgency === "overdue" ? "OVERDUE" : urgency === "urgent" ? "URGENT" : "CAUTION"}
                </span>
              )}
            </div>
            <LiveTimer placedAt={order.placedAt} status={order.status} size="sm" />
          </div>

          {/* ── Row 2: Zone badge + location ── */}
          <div className="flex items-start gap-2">
            {/* Fix 10 — zone badge is the first thing a runner sees */}
            <ZoneBadge section={order.section} floor={order.floor} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-white font-display font-semibold text-sm leading-tight truncate">
                  {order.locationName}
                </p>
                {isOutsideZone && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border text-amber-400 bg-amber-400/10 border-amber-400/30">
                    Not your zone
                  </span>
                )}
              </div>
              {order.guestName && (
                <p className="flex items-center gap-1 text-[10px] font-mono text-gold-400/90 mt-0.5">
                  <User size={9} className="flex-shrink-0" />
                  <span className="truncate">For {order.guestName}</span>
                </p>
              )}
            </div>
          </div>

          {/* ── Items — always visible ── */}
          <div className="bg-raised/60 border border-border/50 rounded-lg px-2.5 py-2 space-y-1.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-[10px] text-slate-400 w-5 text-right flex-shrink-0 mt-0.5">
                  ×{item.qty}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-xs font-body leading-snug">{item.name}</p>
                  {item.note && (
                    <p className="text-amber-400/80 text-[10px] font-body italic mt-0.5">"{item.note}"</p>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-1 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <Clock size={9} />
                {fmtTime(order.placedAt)}
              </div>
            </div>
          </div>

          {/* Guest note */}
          {order.guestNote && (
            <div className="flex items-start gap-1.5 bg-amber-400/6 border border-amber-400/15 rounded-lg px-2.5 py-2">
              <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/90 text-[11px] font-body leading-snug">{order.guestNote}</p>
            </div>
          )}

          {/* Staff attribution */}
          {order.staffName && order.status !== "delivered" && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <User size={9} />
              <span>{order.staffName}</span>
              {order.acceptedAt && <span>· accepted {fmtTime(order.acceptedAt)}</span>}
            </div>
          )}

          {/* Guest alcohol cooldown — read-only display of the SAME
              server-enforced cooldown the guest app shows and checks, not
              a second cooldown concept. Subtle once delivered (the normal
              case); called out more visibly if a new order somehow arrives
              from a guest who's still in cooldown (the edge case). */}
          {showCooldown && (
            order.status === "delivered" ? (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-gold-500/80">
                <Hourglass size={11} />
                <span>Cooldown: {fmtRemaining(cooldownRemainingMs)} remaining</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-400/6 border border-amber-400/15 rounded-lg px-2.5 py-1.5">
                <Hourglass size={11} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-200/80 text-[10px] font-mono">
                  Guest still in cooldown — {fmtRemaining(cooldownRemainingMs)}
                </p>
              </div>
            )
          )}

          {/* ── Action buttons — one-touch, large targets ── */}
          {order.status === "pending" && (
            <div className="flex gap-2 pt-0.5">
              <button
                onClick={() => onAccept(order.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                  "font-body font-bold text-sm transition-all active:scale-[0.97]",
                  "bg-emerald-500 hover:bg-emerald-400 text-white shadow-btn-accept",
                )}
              >
                <CheckCircle2 size={16} />
                Accept
              </button>
              <button
                onClick={() => setShowCancelDlg(true)}
                aria-label="Cancel order"
                className="w-12 h-12 rounded-xl bg-raised border border-border flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all text-lg"
              >
                ×
              </button>
            </div>
          )}

          {(order.status === "accepted" || order.status === "preparing") && (
            <div className="flex gap-2 pt-0.5">
              <button
                onClick={() => onReady(order.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                  "font-body font-bold text-sm transition-all active:scale-[0.97]",
                  "bg-violet-500 hover:bg-violet-400 text-white shadow-btn-ready",
                )}
              >
                <Package size={16} />
                Mark Ready
              </button>
              <button
                onClick={() => setShowCancelDlg(true)}
                aria-label="Cancel order"
                className="w-12 h-12 rounded-xl bg-raised border border-border flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all text-lg"
              >
                ×
              </button>
            </div>
          )}

          {order.status === "ready" && (
            <div className="flex gap-2 pt-0.5">
              <button
                onClick={() => onDeliver(order.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                  "font-body font-bold text-sm transition-all active:scale-[0.97]",
                  "bg-blue-500 hover:bg-blue-400 text-white shadow-btn-deliver",
                )}
              >
                <Truck size={16} />
                Deliver
              </button>
              <button
                onClick={() => setShowCancelDlg(true)}
                aria-label="Cancel order"
                className="w-12 h-12 rounded-xl bg-raised border border-border flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all text-lg"
              >
                ×
              </button>
            </div>
          )}

          {order.status === "delivered" && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-2.5 py-2 min-w-0">
                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] text-emerald-300/80 font-body truncate">
                  Delivered {order.deliveredAt ? `at ${fmtTime(order.deliveredAt)}` : ""}
                  {order.staffName ? ` · ${order.staffName}` : ""}
                </span>
              </div>
              {onConfirmDelivered && (
                <button
                  onClick={() => onConfirmDelivered(order.id)}
                  aria-label="Confirm and clear from board"
                  title="Confirm — removes from board (still searchable by name)"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white shadow-btn-accept transition-all active:scale-[0.96] text-[11px] font-body font-bold"
                >
                  <CheckCircle2 size={12} />
                  Confirm
                </button>
              )}
            </div>
          )}

          {order.status === "cancelled" && order.cancelReason && (
            <div className="flex items-start gap-1.5 bg-slate-500/8 border border-slate-500/20 rounded-lg px-2.5 py-2">
              <span className="text-[10px] text-slate-400 font-mono">CANCELLED: {order.cancelReason}</span>
            </div>
          )}

          {/* Feedback flash */}
          {feedback && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-2 animate-fade-in">
              <CheckCircle2 size={11} className="text-emerald-400" />
              <span className="text-[11px] text-emerald-300 font-body">{feedback}</span>
            </div>
          )}

        </div>
      </article>

      {/* Cancel reason modal — Fix 7 */}
      {showCancelDlg && (
        <CancelReasonModal
          orderLocation={order.locationName}
          onConfirm={handleCancelConfirm}
          onDismiss={() => setShowCancelDlg(false)}
        />
      )}
    </>
  );
}
