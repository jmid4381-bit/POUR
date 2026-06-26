"use client";

import { useRef } from "react";
import { RotateCcw, AlertCircle, Sparkles, Minus, Plus } from "lucide-react";
import { cn, fmtUSD } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useJuly4Surcharge, JULY4_SURCHARGE_AMOUNT, JULY4_SURCHARGE_LABEL } from "@/hooks/useJuly4Surcharge";
import type { CartItem } from "@/lib/data";

interface ReorderConfirmDialogProps {
  items:           CartItem[];
  note?:           string | null; // e.g. "1 alcoholic drink skipped — limit reached for now"
  alcoholRoomLeft?: number;       // how many more alcoholic drinks can still be added
  onUpdateQty?:    (beverageId: string, delta: number) => void;
  onConfirm:       () => void;
  onCancel:        () => void;
  isPlacing:       boolean;
}

export function ReorderConfirmDialog({
  items, note, alcoholRoomLeft = 0, onUpdateQty, onConfirm, onCancel, isPlacing,
}: ReorderConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const subtotal = items.reduce((s, i) => s + i.beverage.price * i.quantity, 0);

  const surchargeActive = useJuly4Surcharge();
  const hasAlcohol = items.some(i => i.beverage.isAlcoholic);
  const surcharge  = surchargeActive && hasAlcohol ? JULY4_SURCHARGE_AMOUNT : 0;
  const total      = subtotal + surcharge;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-void/85 backdrop-blur-md animate-fade-in" onClick={onCancel} aria-hidden />

      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm reorder"
          className="pointer-events-auto w-full max-w-sm rounded-3xl overflow-hidden shadow-modal bg-card animate-scale-in"
        >
          <div className="h-[2px] bg-felt-grad" />
          <div className="p-5 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 bg-felt-grad rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-btn-felt">
                <RotateCcw size={22} className="text-white" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white">Re-place this order?</h2>
              <p className="text-mist-400 text-sm font-body mt-1">
                This places a new order immediately — no review step.
              </p>
            </div>

            <div className="bg-lift/60 border border-edge rounded-2xl p-3.5 space-y-2 max-h-52 overflow-y-auto">
              {items.map((item, i) => {
                const atAlcoholLimit = item.beverage.isAlcoholic && alcoholRoomLeft <= 0;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-mist-200 font-body min-w-0 truncate">{item.beverage.name}</span>
                    {onUpdateQty ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => onUpdateQty(item.beverage.id, -1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease ${item.beverage.name} quantity`}
                          className="w-6 h-6 rounded-lg bg-void border border-edge flex items-center justify-center text-mist-400 hover:text-white hover:border-rim transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-4 text-center font-mono text-white font-bold text-xs">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQty(item.beverage.id, 1)}
                          disabled={atAlcoholLimit || item.quantity >= 8}
                          aria-label={`Increase ${item.beverage.name} quantity`}
                          title={atAlcoholLimit ? "Drink limit reached for now" : undefined}
                          className="w-6 h-6 rounded-lg bg-void border border-edge flex items-center justify-center text-mist-400 hover:text-white hover:border-rim transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={10} />
                        </button>
                        <span className={cn("font-mono text-xs w-12 text-right", item.quantity > 1 ? "text-mist-300" : "text-mist-500")}>
                          {fmtUSD(item.beverage.price * item.quantity)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-mist-400 flex-shrink-0">
                        {item.quantity > 1 && <span className="text-mist-500 mr-1">×{item.quantity}</span>}
                        {fmtUSD(item.beverage.price * item.quantity)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {surcharge > 0 && (
              <div className="flex items-center gap-2 bg-amber-400/8 border border-amber-400/20 rounded-xl px-3 py-2">
                <Sparkles size={13} className="text-amber-400 flex-shrink-0" />
                <span className="flex-1 text-amber-300 text-xs font-body">{JULY4_SURCHARGE_LABEL}</span>
                <span className="font-mono text-xs font-semibold text-amber-300">{fmtUSD(surcharge)}</span>
              </div>
            )}

            <div className="flex justify-between px-1">
              <span className="text-sm text-mist-400 font-body">Total</span>
              <span className="font-mono font-bold text-white">{fmtUSD(total)}</span>
            </div>

            {note && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-400/8 border border-amber-400/20 rounded-xl">
                <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs font-body">{note}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onCancel}
                disabled={isPlacing}
                className="flex-1 py-3.5 rounded-2xl font-body font-bold text-sm bg-lift border border-edge text-mist-300 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50"
              >
                No, cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isPlacing}
                className="flex-1 py-3.5 rounded-2xl font-body font-bold text-sm bg-felt-grad text-white shadow-btn-felt hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {isPlacing ? "Placing…" : "Yes, place order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
