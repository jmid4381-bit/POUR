"use client";

import { X, MapPin, Trash2, ShoppingBag, ArrowLeft, Minus, Plus, ChevronDown, Sparkles } from "lucide-react";
import { useState, useRef } from "react";
import { cn, fmtUSD } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useJuly4Surcharge, JULY4_SURCHARGE_AMOUNT, JULY4_SURCHARGE_LABEL } from "@/hooks/useJuly4Surcharge";
import type { CartItem } from "@/lib/data";
import { GIANT_UPCHARGE } from "@/lib/data";

interface OrderReviewModalProps {
  cart:         CartItem[];
  locationName: string;
  isSubmitting: boolean;
  onConfirm:    () => void;
  onClose:      () => void;
  onRemoveItem: (beverageId: string) => void;
  onUpdateQty:  (beverageId: string, delta: number) => void;
  locationId:   string;
}

export function OrderReviewModal({
  cart, locationName, isSubmitting,
  onConfirm, onClose, onRemoveItem, onUpdateQty, locationId,
}: OrderReviewModalProps) {
  const [showItems, setShowItems] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  // ── Bottom-sheet entrance + swipe-to-dismiss ──────────────────────────────
  // Entrance uses the CSS `animate-sheet-up` keyframe (translateY 100%→0) — no
  // rAF/JS timer, so it can't get stuck. The moment the guest interacts (drag
  // or any close), we switch to an inline transform we control: the grabber
  // drag follows the finger and closes past a threshold (else snaps back), and
  // every close route (X, back, Add More, backdrop, swipe) slides down first.
  const [closing, setClosing]       = useState(false);
  const [dragY,   setDragY]         = useState(0);
  const [interacted, setInteracted] = useState(false);
  const dragging = useRef(false);
  const startY   = useRef(0);

  const requestClose = () => {
    if (closing) return;
    setInteracted(true);
    setClosing(true);
    setTimeout(onClose, 300); // matches the transform transition below
  };

  const onHandleDown = (e: React.PointerEvent) => {
    setInteracted(true);
    dragging.current = true;
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onHandleUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragY > 110) requestClose();
    else setDragY(0);
  };

  const useInline = interacted || closing;
  const panelStyle: React.CSSProperties | undefined = useInline ? {
    transform: `translateY(${closing ? "100%" : `${dragY}px`})`,
    transition: dragging.current ? "none" : "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
  } : undefined;

  const subtotal    = cart.reduce((s, i) => s + (i.beverage.price + (i.size === "giant" ? GIANT_UPCHARGE : 0)) * i.quantity, 0);
  const itemCount   = cart.reduce((s, i) => s + i.quantity, 0);
  const uniqueCount = cart.length;

  const surchargeActive = useJuly4Surcharge(locationId);
  const hasAlcohol  = cart.some(i => i.beverage.isAlcoholic);
  const surcharge   = surchargeActive && hasAlcohol ? JULY4_SURCHARGE_AMOUNT : 0;
  const total       = subtotal + surcharge;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-void/85 backdrop-blur-md animate-fade-in"
        onClick={requestClose}
        aria-hidden
      />

      {/* Full-viewport flex wrapper — bottom-anchored sheet */}
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">

        {/* Sheet panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review your order"
          ref={panelRef}
          style={panelStyle}
          className={cn(
            "pointer-events-auto w-full max-w-md bg-card rounded-t-3xl shadow-modal flex flex-col max-h-[88dvh]",
            !useInline && "animate-sheet-up",
          )}
        >

          {/* Drag handle — swipe down to dismiss */}
          <div
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            className="flex-shrink-0 flex items-center justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            aria-hidden
          >
            <div className="w-10 h-1.5 rounded-full bg-mist-600/60" />
          </div>

          {/* Gold top stripe */}
          <div className="h-[3px] w-full bg-gold-grad flex-shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={requestClose}
                aria-label="Back to menu"
                className="w-8 h-8 rounded-xl bg-lift flex items-center justify-center text-mist-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={15} />
              </button>
              <div>
                <h3 className="font-display text-xl font-semibold text-white leading-none">Review Order</h3>
                <p className="text-[11px] text-mist-500 font-mono mt-0.5">
                  {itemCount} drink{itemCount !== 1 ? "s" : ""} · {locationName}
                </p>
              </div>
            </div>
            <button
              onClick={requestClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-lift flex items-center justify-center text-mist-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Primary action zone — always visible, first thing guest sees */}
          <div className="flex-shrink-0 px-5 pt-4 pb-5 space-y-3 border-b border-edge bg-lift/20">

            {/* Delivery + total */}
            <div className="flex items-center gap-2 bg-felt-500/8 border border-felt-500/15 rounded-xl px-3 py-2.5">
              <MapPin size={13} className="text-felt-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-felt-400 uppercase tracking-wider leading-none">Delivering to</p>
                <p className="text-white text-sm font-body font-medium mt-0.5 truncate">{locationName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-mono text-mist-500 leading-none">Total</p>
                <p className="text-white font-mono font-bold text-base mt-0.5">{fmtUSD(total)}</p>
              </div>
            </div>

            {/* 4th of July surcharge notice — live, appears/disappears as the
                guest's last alcoholic item is added/removed */}
            {surcharge > 0 && (
              <div className="flex items-center gap-2 bg-amber-400/8 border border-amber-400/20 rounded-xl px-3 py-2 animate-fade-in">
                <Sparkles size={13} className="text-amber-400 flex-shrink-0" />
                <span className="flex-1 text-amber-300 text-xs font-body">{JULY4_SURCHARGE_LABEL}</span>
                <span className="font-mono text-xs font-semibold text-amber-300">{fmtUSD(surcharge)}</span>
              </div>
            )}

            {/* Place Order button — large, impossible to miss */}
            <button
              onClick={onConfirm}
              disabled={isSubmitting || cart.length === 0}
              aria-label="Place your order"
              className={cn(
                "w-full py-4 rounded-2xl font-body font-bold text-lg",
                "flex items-center justify-center gap-3",
                "transition-all duration-200 active:scale-[0.98]",
                "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
                (isSubmitting || cart.length === 0) && "opacity-60 cursor-not-allowed",
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Placing your order…
                </>
              ) : (
                <>
                  <ShoppingBag size={20} />
                  Place Order · {fmtUSD(total)}
                </>
              )}
            </button>

            {/* Add More Drinks — minimizes the sheet back to the menu, cart kept */}
            <button
              onClick={requestClose}
              aria-label="Add more drinks"
              className="w-full py-2.5 rounded-xl font-body font-semibold text-sm flex items-center justify-center gap-2 bg-lift border border-edge text-mist-200 hover:text-white hover:border-rim transition-all active:scale-[0.98]"
            >
              <Plus size={15} /> Add More Drinks
            </button>

            <p className="text-center text-[11px] text-mist-600 font-body">
              Delivered to your seat · Payment handled at your table
            </p>

          </div>
          {/* end primary action zone */}

          {/* Scrollable items list — flex-1 + overflow-y-auto = scrolls freely */}
          <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col">

            {/* Toggle row */}
            <button
              onClick={() => setShowItems(s => !s)}
              className="flex items-center justify-between px-5 py-3 border-b border-edge text-mist-300 hover:text-white transition-colors flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-mist-500">Order Details</span>
                <span className="text-[10px] font-mono bg-lift border border-edge text-mist-400 rounded-full px-2 py-0.5">
                  {uniqueCount} {uniqueCount === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-body text-mist-400">
                {showItems ? "Hide" : "Show"}
                <ChevronDown size={14} className={cn("transition-transform duration-200", showItems && "rotate-180")} />
              </div>
            </button>

            {/* Item rows */}
            {showItems && (
              <div className="px-5 py-3 space-y-2">

                {cart.map(item => (
                  <div key={item.beverage.id} className="flex items-center gap-3 bg-lift border border-edge rounded-2xl px-3.5 py-3 animate-row-in">

                    <span className="text-2xl flex-shrink-0">{item.beverage.emoji}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-white font-body text-sm font-medium leading-tight truncate">{item.beverage.name}</p>
                        {item.size === "giant" && (
                          <span className="text-[9px] font-mono text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full px-1.5 py-0.5 flex-shrink-0">GIANT</span>
                        )}
                      </div>
                      {item.note && (
                        <p className="text-amber-400/70 text-xs font-body italic mt-0.5 line-clamp-1">"{item.note}"</p>
                      )}
                      <p className="text-mist-500 font-mono text-xs mt-0.5">{fmtUSD(item.beverage.price + (item.size === "giant" ? GIANT_UPCHARGE : 0))} each</p>
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onUpdateQty(item.beverage.id, -1)}
                        aria-label="Decrease quantity"
                        className="w-7 h-7 rounded-lg bg-void border border-edge flex items-center justify-center text-mist-400 hover:text-white hover:border-rim transition-all active:scale-90"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-5 text-center font-mono text-white font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.beverage.id, 1)}
                        aria-label="Increase quantity"
                        className="w-7 h-7 rounded-lg bg-void border border-edge flex items-center justify-center text-mist-400 hover:text-white hover:border-rim transition-all active:scale-90"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    {/* Subtotal + remove */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-1">
                      <span className="font-mono text-sm font-semibold text-white">{fmtUSD((item.beverage.price + (item.size === "giant" ? GIANT_UPCHARGE : 0)) * item.quantity)}</span>
                      <button
                        onClick={() => onRemoveItem(item.beverage.id)}
                        aria-label={`Remove ${item.beverage.name}`}
                        className="text-mist-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                  </div>
                ))}

                {/* Repeat confirm at bottom after scrolling through items. Extra
                    bottom padding + safe-area inset so this CTA (the last thing
                    in the scrollable sheet) clears the home indicator instead of
                    sitting flush against it when installed to the Home Screen. */}
                <div className="pt-2 space-y-2" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                  <div className="space-y-1 pt-2 border-t border-edge">
                    <div className="flex justify-between text-sm">
                      <span className="text-mist-400 font-body">{itemCount} drink{itemCount !== 1 ? "s" : ""}</span>
                      <span className="font-mono text-mist-300">{fmtUSD(subtotal)}</span>
                    </div>
                    {surcharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-400 font-body">{JULY4_SURCHARGE_LABEL}</span>
                        <span className="font-mono text-amber-300">{fmtUSD(surcharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-white font-body font-semibold">Total</span>
                      <span className="font-mono font-bold text-white">{fmtUSD(total)}</span>
                    </div>
                  </div>
                  <button
                    onClick={onConfirm}
                    disabled={isSubmitting || cart.length === 0}
                    className={cn(
                      "w-full py-3.5 rounded-2xl font-body font-bold text-base",
                      "flex items-center justify-center gap-2.5",
                      "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
                      "transition-all active:scale-[0.98]",
                      (isSubmitting || cart.length === 0) && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    {isSubmitting ? "Placing your order…" : `Place Order · ${fmtUSD(total)}`}
                  </button>
                </div>

              </div>
            )}
            {/* end item rows */}

          </div>
          {/* end scrollable items list */}

        </div>
        {/* end modal panel */}

      </div>
      {/* end flex centering wrapper */}
    </>
  );
}
