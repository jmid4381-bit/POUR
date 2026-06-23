"use client";

import { X, MapPin, Trash2, ShoppingBag, ArrowLeft, Minus, Plus, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import { cn, fmtUSD } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { CartItem } from "@/lib/data";

interface OrderReviewModalProps {
  cart:         CartItem[];
  locationName: string;
  isSubmitting: boolean;
  onConfirm:    () => void;
  onClose:      () => void;
  onRemoveItem: (beverageId: string) => void;
  onUpdateQty:  (beverageId: string, delta: number) => void;
}

export function OrderReviewModal({
  cart, locationName, isSubmitting,
  onConfirm, onClose, onRemoveItem, onUpdateQty,
}: OrderReviewModalProps) {
  const [showItems, setShowItems] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const total       = cart.reduce((s, i) => s + i.beverage.price * i.quantity, 0);
  const itemCount   = cart.reduce((s, i) => s + i.quantity, 0);
  const uniqueCount = cart.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-void/85 backdrop-blur-md animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Full-viewport flex wrapper — bulletproof centering */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">

        {/* Modal panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review your order"
          ref={panelRef}
          className="pointer-events-auto w-full max-w-md bg-card rounded-3xl shadow-modal flex flex-col max-h-[88dvh] animate-scale-in"
        >

          {/* Gold top stripe */}
          <div className="h-[3px] w-full bg-gold-grad flex-shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
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
              onClick={onClose}
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
                      <p className="text-white font-body text-sm font-medium leading-tight truncate">{item.beverage.name}</p>
                      {item.note && (
                        <p className="text-amber-400/70 text-xs font-body italic mt-0.5 line-clamp-1">"{item.note}"</p>
                      )}
                      <p className="text-mist-500 font-mono text-xs mt-0.5">{fmtUSD(item.beverage.price)} each</p>
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
                      <span className="font-mono text-sm font-semibold text-white">{fmtUSD(item.beverage.price * item.quantity)}</span>
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

                {/* Repeat confirm at bottom after scrolling through items */}
                <div className="pt-2 pb-1 space-y-2">
                  <div className="flex justify-between text-sm pt-2 border-t border-edge">
                    <span className="text-mist-400 font-body">{itemCount} drink{itemCount !== 1 ? "s" : ""}</span>
                    <span className="font-mono font-bold text-white">{fmtUSD(total)}</span>
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
