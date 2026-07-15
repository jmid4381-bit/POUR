"use client";

/**
 * OrderConfirmation — Fix 3
 *
 * The progress tracker now advances in real time based on elapsed time
 * vs estimated wait. Steps unlock at natural milestones:
 *
 *  Received   → immediately (0%)
 *  Preparing  → after 8% of estimated time (~30s on an 8min order)
 *  On the way → after 65% of estimated time
 *  Delivered  → after 95% of estimated time
 *
 * Also polls the order queue every 15s for real status updates.
 * When a real backend is connected, replace readOrderStatus() with
 * a websocket subscription and the UI updates automatically.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle, Clock, MapPin, RotateCcw, UserRound, Receipt, X, BellRing } from "lucide-react";
import { cn, fmtUSD, fmtTime } from "@/lib/utils";
import { readOrderStatus, readOrderStaffName, type QueuedOrderStatus } from "@/lib/queue";
import { supabase } from "@/lib/supabase";
import { warmAudio, fireAlert } from "@/lib/notify";
import { logMessage } from "@/lib/logger";
import { PushOptIn } from "./PushOptIn";
import { InstallAppCard } from "./InstallAppCard";
import { Fireworks } from "./Fireworks";
import { HOLIDAY_THEME_ACTIVE } from "@/lib/config";
import type { PlacedOrder } from "@/lib/data";
import { GIANT_UPCHARGE } from "@/lib/data";

interface OrderConfirmationProps {
  order:        PlacedOrder;
  onOrderMore:  () => void;
  onReorder:    () => void;
  onViewOrders: () => void;
}

// Step unlocks at this fraction of estimatedMinutes elapsed
const STEP_THRESHOLDS = [0, 0.08, 0.65, 0.95];

const STEPS = [
  { label: "Received",   ariaLabel: "Order received by the bar" },
  { label: "Preparing",  ariaLabel: "Drinks are being prepared"  },
  { label: "On the way", ariaLabel: "Drinks are on the way to your seat" },
  { label: "Delivered",  ariaLabel: "Drinks delivered to your seat" },
];

// Map real staff-dashboard statuses to our step index
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

export function OrderConfirmation({ order, onOrderMore, onReorder, onViewOrders }: OrderConfirmationProps) {
  const subtotal  = order.items.reduce((s, i) => s + (i.beverage.price + (i.size === "giant" ? GIANT_UPCHARGE : 0)) * i.quantity, 0);
  const surcharge = order.surchargeAmount ?? 0;
  const total     = subtotal + surcharge;

  // ── Live step tracking ───────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [staffName,   setStaffName]   = useState<string | null>(null);

  // ── Milestone alerts ──────────────────────────────────────────────────────
  // A transient on-screen banner (paired with chime/haptic/tab-title flash from
  // lib/notify) fired when *real staff status* crosses a milestone the guest
  // should notice — "on the way" and "delivered". We gate on real status, not
  // the time-based estimate, so we never cry wolf before the bartender actually
  // moves the order. `alertedStaffStep` is seeded from the first status read
  // WITHOUT firing, so reopening an already-ready order doesn't alarm late.
  const [banner, setBanner] = useState<{ title: string; sub: string; bright: boolean } | null>(null);
  const alertedStaffStep = useRef<number | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((title: string, sub: string, bright: boolean) => {
    fireAlert(title, bright);
    setBanner({ title, sub, bright });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 6_000);
  }, []);

  // Warm the AudioContext off the place-order tap that brought us here, so a
  // chime minutes later (when there's no fresh gesture) still plays.
  useEffect(() => {
    warmAudio();
    return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); };
  }, []);

  // Fireworks — only on the initial mount of this screen (this effect's
  // empty deps array guarantees that), only during the holiday event, and
  // never if the guest's device has reduced motion enabled.
  const [showFireworks, setShowFireworks] = useState(false);
  useEffect(() => {
    if (!HOLIDAY_THEME_ACTIVE) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    setShowFireworks(true);
  }, []);

  // Local clock tick — pure math, no network — ticks every second so the
  // visible step advances at the same real-world instant regardless of when
  // this screen happened to mount (a 10s-only tick would drift out of phase
  // with other views of the same order by up to 10s).
  useEffect(() => {
    const placedAt = new Date(order.placedAt).getTime();

    const tick = () => {
      const elapsed  = (Date.now() - placedAt) / 1000;
      const fraction = elapsed / (order.estimatedMinutes * 60);
      setElapsedSecs(Math.floor(elapsed));

      let timeStep = 0;
      for (let i = STEP_THRESHOLDS.length - 1; i >= 0; i--) {
        if (fraction >= STEP_THRESHOLDS[i]) { timeStep = i; break; }
      }
      setCurrentStep(prev => Math.max(prev, timeStep));
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [order.placedAt, order.estimatedMinutes]);

  // Refresh real staff status/name and reconcile it with the tracker. Shared
  // by the realtime subscription (instant) and the interval poll (fallback),
  // so both paths run identical logic and firing an alert is idempotent.
  const refreshStatus = useCallback(async () => {
    const [realStatus, name] = await Promise.all([
      readOrderStatus(order.id),
      readOrderStaffName(order.id),
    ]);
    // "delivered" means fully complete — including the 4th step itself, which
    // statusToStep alone can never express since it returns the last valid
    // index (3), not "one past the end."
    const staffStep = realStatus === "delivered" ? STEPS.length : statusToStep(realStatus);

    // Fire milestone alerts on upward transitions of the REAL status only.
    // Seed the baseline on the first read so an already-advanced order (guest
    // reopened the screen) doesn't retro-fire.
    if (alertedStaffStep.current === null) {
      alertedStaffStep.current = staffStep;
    } else if (staffStep > alertedStaffStep.current) {
      const crossedPreparing = alertedStaffStep.current < 1 && staffStep >= 1;
      const crossedOnTheWay  = alertedStaffStep.current < 2 && staffStep >= 2;
      const crossedDelivered = alertedStaffStep.current < STEPS.length && staffStep >= STEPS.length;
      if (crossedDelivered) {
        showBanner("Delivered — enjoy your drinks!", "Your order just arrived at your seat.", true);
      } else if (crossedOnTheWay) {
        showBanner("Your order is on the way!", "A server is bringing it to your seat now.", false);
      } else if (crossedPreparing) {
        showBanner("Your order is being prepared!", "A bartender just started on your drinks.", false);
      }
      alertedStaffStep.current = staffStep;
    }

    setCurrentStep(prev => Math.max(prev, staffStep));
    if (name) setStaffName(name);
  }, [order.id, showBanner]);

  // Realtime is the fast path: `orders` is in the supabase_realtime publication,
  // so a status change from the staff dashboard pushes here instantly. The
  // interval poll below is a fallback that also covers the case where the anon
  // role can't receive row events (RLS) — if realtime silently delivers
  // nothing, the poll keeps the tracker correct exactly as before.
  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 5_000);

    const channel = supabase
      .channel(`order-status:${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        () => { refreshStatus(); },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logMessage("Realtime subscription failed: order-status", { status, orderId: order.id });
        }
      });

    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [order.id, refreshStatus]);

  const isDelivered     = currentStep >= 3;
  // currentStep can be STEPS.length (4) to mark every step done — clamp
  // before indexing STEPS with it, or STEPS[4] is undefined and crashes.
  const displayStep     = Math.min(currentStep, STEPS.length - 1);
  const remainingSecs   = Math.max(0, order.estimatedMinutes * 60 - elapsedSecs);
  const remainingMins   = Math.ceil(remainingSecs / 60);

  return (
    <div
      className="min-h-screen bg-base flex flex-col items-center justify-start pt-[calc(3rem+env(safe-area-inset-top))] px-4 animate-fade-in"
      // Extra clearance below pb-32's base padding for the home indicator AND
      // Stripe's floating account badge (bottom-right, fixed position) — so
      // the last button on the page never sits flush under either.
      style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
    >
      {showFireworks && <Fireworks />}
      <div className="fixed inset-0 bg-hero-glow pointer-events-none" />

      {/* Milestone alert banner — fires with a chime/haptic when the real
          order status crosses "being prepared" / "on the way" / "delivered".
          Auto-dismisses. top offset clears BOTH the status bar/notch (when
          installed to Home Screen) AND the close (X) button's row below it —
          previously fixed at top-3 with no safe-area awareness, so it sat
          under the clock/battery and visually covered the X (which is z-20,
          under this banner's z-50). */}
      {banner && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => setBanner(null)}
            className={cn(
              "pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl px-4 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.55)] border-2 animate-sheet-up text-left",
              banner.bright
                ? "bg-gold-grad border-gold-300/60"
                : "bg-felt-grad border-felt-300/60",
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              banner.bright ? "bg-void/20" : "bg-white/20",
            )}>
              <BellRing size={20} className={banner.bright ? "text-void" : "text-white"} />
            </div>
            <div className="min-w-0">
              <p className={cn("font-body font-extrabold text-base leading-tight", banner.bright ? "text-void" : "text-white")}>
                {banner.title}
              </p>
              <p className={cn("font-body text-sm leading-snug mt-1", banner.bright ? "text-void/80" : "text-white/90")}>
                {banner.sub}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Quick exit — same destination as "Order More Drinks", for a guest
          who just wants back to the menu without reading this screen */}
      <button
        onClick={onOrderMore}
        aria-label="Close and return to menu"
        // top-[calc(1rem+safe-area)] keeps this clear of the iOS status bar/
        // notch when installed to the Home Screen (viewport-fit=cover draws
        // full-bleed otherwise). Resolves to 1rem in a normal browser tab.
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-20 w-9 h-9 rounded-full bg-lift/90 backdrop-blur-sm border border-edge flex items-center justify-center text-mist-400 hover:text-white hover:border-rim transition-all"
      >
        <X size={16} />
      </button>

      <div className="relative z-10 w-full max-w-sm space-y-6">

        {/* Success icon */}
        <div className="text-center">
          <div className={cn(
            "w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center shadow-btn-felt animate-scale-in",
            isDelivered ? "bg-gold-grad" : "bg-felt-grad",
          )}>
            <CheckCircle size={36} className="text-white" strokeWidth={1.5} />
          </div>
          <h2 className="font-display text-4xl font-semibold text-white mb-2 animate-fade-up">
            {isDelivered ? "Enjoy your drinks!" : "Order Placed!"}
          </h2>
          <p className="text-mist-300 text-sm font-body animate-fade-up" style={{ animationDelay:"0.05s" }}>
            {isDelivered
              ? "Your order has been delivered. Cheers!"
              : "Your drinks are being prepared right now."}
          </p>
        </div>

        {/* Order card */}
        <div className="bg-card border border-edge rounded-2xl overflow-hidden shadow-card animate-fade-up" style={{ animationDelay:"0.1s" }}>
          <div className="h-[2px] bg-gold-grad" />
          <div className="p-5 space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-mist-500 uppercase tracking-widest">Order</p>
                <p className="font-mono text-sm text-white font-semibold">{order.id}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono text-mist-500 uppercase tracking-widest">Placed</p>
                <p className="font-mono text-sm text-mist-200">{fmtTime(order.placedAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-lift/60 border border-edge rounded-xl px-3 py-2.5">
              <MapPin size={14} className="text-felt-500 flex-shrink-0" />
              <p className="text-white text-sm font-body font-medium">{order.locationName}</p>
            </div>

            <div className="space-y-2">
              {order.items.map((item, i) => {
                const unitPrice = item.beverage.price + (item.size === "giant" ? GIANT_UPCHARGE : 0);
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg flex-shrink-0">{item.beverage.emoji}</span>
                      <span className="text-mist-200 font-body truncate">
                        {item.beverage.name}
                        {item.size === "giant" && (
                          <span className="ml-1.5 text-[9px] font-mono font-bold text-blue-400 bg-blue-400/15 border border-blue-400/30 rounded px-1 py-0.5 align-middle">GIANT</span>
                        )}
                        {item.quantity > 1 && <span className="text-mist-500 font-mono ml-1">×{item.quantity}</span>}
                      </span>
                    </div>
                    <span className="font-mono text-mist-300 flex-shrink-0">
                      {fmtUSD(unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}

              {order.items.some(i => i.note) && (
                <div className="mt-2 px-3 py-2 bg-amber-400/5 border border-amber-400/15 rounded-xl">
                  {order.items.filter(i => i.note).map((item, i) => (
                    <p key={i} className="text-xs text-amber-300/80 font-body italic">
                      {item.beverage.name}: "{item.note}"
                    </p>
                  ))}
                </div>
              )}
            </div>

            {surcharge > 0 && (
              <div className="flex items-center justify-between bg-amber-400/8 border border-amber-400/20 rounded-xl px-3 py-2">
                <span className="text-amber-300 text-xs font-body">{order.surchargeLabel}</span>
                <span className="font-mono text-xs font-semibold text-amber-300">{fmtUSD(surcharge)}</span>
              </div>
            )}

            <div className="flex justify-between pt-3 border-t border-edge">
              <span className="text-sm text-mist-400 font-body">Total</span>
              <span className="font-mono font-bold text-white">{fmtUSD(total)}</span>
            </div>
          </div>
        </div>

        {/* ETA card — updates live */}
        {!isDelivered && (
          <div className="bg-card border border-felt-500/20 rounded-2xl p-5 flex items-center gap-4 animate-fade-up" style={{ animationDelay:"0.15s" }}>
            <div className="w-12 h-12 bg-felt-grad rounded-xl flex items-center justify-center shadow-btn-felt flex-shrink-0">
              <Clock size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-body font-semibold" aria-live="polite">
                {remainingMins <= 1 ? "Almost there!" : `~${remainingMins} minute${remainingMins !== 1 ? "s" : ""} remaining`}
              </p>
              <p className="text-felt-400 text-xs font-body mt-0.5">Estimated delivery to your seat</p>
            </div>
          </div>
        )}

        {/* Real push opt-in — notifications that fire even with the tab closed.
            Hidden once delivered (nothing left to alert on). */}
        {!isDelivered && <PushOptIn orderId={order.id} />}

        {/* Android one-tap install — renders only when Chrome actually offers
            it (self-hides on iOS/desktop/already-installed). */}
        {!isDelivered && <InstallAppCard />}

        {/* Bartender assignment — only shown once someone has actually claimed it */}
        {staffName && !isDelivered && (
          <div className="bg-card border border-gold-500/20 rounded-2xl p-5 flex items-center gap-4 animate-fade-up" style={{ animationDelay:"0.17s" }}>
            <div className="w-12 h-12 bg-gold-grad rounded-xl flex items-center justify-center shadow-btn-gold flex-shrink-0">
              <UserRound size={20} className="text-void" />
            </div>
            <div>
              <p className="text-white font-body font-semibold" aria-live="polite">
                {currentStep >= 2 ? `${staffName} is bringing your order` : `${staffName} is preparing your order`}
              </p>
              <p className="text-gold-400/80 text-xs font-body mt-0.5">Your dedicated server</p>
            </div>
          </div>
        )}

        {/* Live progress tracker — advances automatically */}
        <div
          className="bg-card border border-edge rounded-2xl p-5 animate-fade-up"
          style={{ animationDelay:"0.2s" }}
          role="status"
          aria-label={`Order status: ${STEPS[displayStep].ariaLabel}`}
          aria-live="polite"
        >
          <p className="text-[10px] font-mono text-mist-500 uppercase tracking-widest mb-4">Order Progress</p>
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const isDone   = i < currentStep;
              const isActive = i === currentStep;
              return (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500",
                      isDone   ? "bg-felt-grad text-white shadow-btn-felt" :
                      isActive ? "border-2 border-felt-500 text-felt-400 animate-pulse-dot" :
                                 "bg-lift border border-edge text-mist-600",
                    )}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span className={cn(
                      "text-[9px] font-mono uppercase tracking-wide whitespace-nowrap",
                      isDone || isActive ? "text-felt-400" : "text-mist-600",
                    )}>
                      {step.label}
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
        </div>

        {/* Order more */}
        <button
          onClick={onOrderMore}
          className="w-full py-4 rounded-2xl font-body font-bold text-base animate-fade-up bg-felt-grad text-white shadow-btn-felt hover:brightness-110 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
          style={{ animationDelay:"0.25s" }}
        >
          <RotateCcw size={16} />
          Order More Drinks
        </button>

        {/* Secondary actions — quick reorder of this exact order, and a
            clear, explicit path to My Orders right when a guest would most
            want to know it exists */}
        <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay:"0.27s" }}>
          <button
            onClick={onReorder}
            className="py-3 rounded-2xl font-body font-semibold text-sm bg-lift border border-edge text-mist-200 hover:border-felt-600/40 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <RotateCcw size={14} />
            Reorder
          </button>
          <button
            onClick={onViewOrders}
            className="py-3 rounded-2xl font-body font-semibold text-sm bg-lift border border-edge text-mist-200 hover:border-gold-600/40 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Receipt size={14} />
            View My Orders
          </button>
        </div>

        <p className="text-center text-[11px] text-mist-600 font-body animate-fade-up" style={{ animationDelay:"0.3s" }}>
          A server will bring your order directly to your seat.
          <br />No need to wait at the bar.
        </p>
      </div>
    </div>
  );
}
