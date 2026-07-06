"use client";

/**
 * CancelReasonModal — Fix 7: cancellations now capture a reason.
 *
 * Four options cover >95% of real casino cancellation scenarios.
 * The selected reason is stored on the order for operations review.
 */

import { useState } from "react";
import { X, UserX, Package, Copy, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const CANCEL_REASONS = [
  { id: "guest_left",       label: "Guest Left",        icon: UserX,     desc: "Guest departed before delivery"  },
  { id: "item_unavailable", label: "Item Unavailable",  icon: Package,   desc: "Out of stock or unable to make"  },
  { id: "duplicate",        label: "Duplicate Order",   icon: Copy,      desc: "Same order placed more than once" },
  { id: "other",            label: "Other",             icon: HelpCircle,desc: "Add a note below"                },
] as const;

export type CancelReasonId = typeof CANCEL_REASONS[number]["id"];

interface CancelReasonModalProps {
  orderLocation: string;
  onConfirm:     (reason: CancelReasonId, note: string) => void;
  onDismiss:     () => void;
}

export function CancelReasonModal({ orderLocation, onConfirm, onDismiss }: CancelReasonModalProps) {
  const [selected, setSelected] = useState<CancelReasonId | null>(null);
  const [note,     setNote]     = useState("");
  const [busy,     setBusy]     = useState(false);

  const canSubmit = selected !== null;

  const handleConfirm = async () => {
    if (!selected || busy) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 250));
    const reasonLabel = CANCEL_REASONS.find(r => r.id === selected)?.label ?? selected;
    const full = note.trim() ? `${reasonLabel} — ${note.trim()}` : reasonLabel;
    onConfirm(selected, full);
    setBusy(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm animate-fade-in"
        onClick={onDismiss}
        aria-hidden
      />

      {/* Modal — centered, height-capped, and internally scrollable so the
          confirm actions are always reachable even on short screens or with the
          on-screen keyboard up (this was unscrollable before — buttons could sit
          off the bottom of the phone with no way to reach them). */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cancel order reason"
          className="pointer-events-auto w-full max-w-sm bg-surface border border-red-500/20 rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.8)] flex flex-col max-h-[90dvh] animate-fade-up"
        >
          <div className="h-[2px] w-full bg-red-500 flex-shrink-0" />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-white text-base leading-tight">
                  Cancel Order
                </h3>
                <p className="text-slate-500 text-xs font-body mt-0.5 truncate max-w-[200px]">
                  {orderLocation}
                </p>
              </div>
              <button
                onClick={onDismiss}
                className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Reason options */}
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
                Reason for cancellation
              </p>
              <div className="space-y-1.5">
                {CANCEL_REASONS.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setSelected(id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left",
                      "transition-all duration-150 active:scale-[0.98]",
                      selected === id
                        ? "bg-red-500/10 border-red-500/30 text-white"
                        : "bg-raised border-border text-slate-300 hover:border-rim hover:text-white",
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                      selected === id
                        ? "bg-red-500/15 text-red-400"
                        : "bg-surface text-slate-500",
                    )}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-body font-semibold leading-tight">{label}</p>
                      <p className="text-[11px] text-slate-500 font-body">{desc}</p>
                    </div>
                    {selected === id && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[8px] font-bold">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional note */}
            {(selected === "other" || selected) && (
              <div className="animate-fade-in">
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Optional: add details…"
                  maxLength={120}
                  className="w-full bg-raised border border-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 font-body resize-none focus:outline-none focus:border-red-500/30 transition-colors"
                />
              </div>
            )}

          </div>
          {/* end scrollable content */}

          {/* Pinned actions — always visible regardless of content height */}
          <div className="flex-shrink-0 flex gap-2 p-4 pt-3 border-t border-border">
            <button
              onClick={handleConfirm}
              disabled={!canSubmit || busy}
              className={cn(
                "flex-1 py-3 rounded-xl font-body font-bold text-sm transition-all active:scale-[0.97]",
                canSubmit
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-raised border border-border text-slate-600 cursor-not-allowed",
              )}
            >
              {busy ? "Cancelling…" : "Confirm Cancel"}
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 py-3 rounded-xl bg-raised border border-border text-slate-300 font-body font-semibold text-sm hover:border-rim hover:text-white transition-all active:scale-[0.97]"
            >
              Keep Order
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
