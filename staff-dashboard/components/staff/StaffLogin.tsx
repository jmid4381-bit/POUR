"use client";

import { useState } from "react";
import { Zap, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Only real staff members may appear here — no placeholder/test names,
// and no free-text entry, so no other name can ever be selected.
const STAFF_NAMES = ["Evan", "Justin", "Bray"];

interface StaffLoginProps {
  onLogin: (name: string) => void;
}

export function StaffLogin({ onLogin }: StaffLoginProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!selected) return;
    onLogin(selected);
  };

  return (
    <div className="fixed inset-0 z-50 bg-void flex items-center justify-center p-4">
      {/* Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(201,160,48,0.07),transparent)] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage:"radial-gradient(circle,rgba(30,46,66,0.7) 1px,transparent 1px)", backgroundSize:"32px 32px" }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_4px_24px_rgba(201,160,48,0.3)]"
            style={{ background: "var(--venue-accent, #C9A030)" }}
          >
            <Zap size={24} className="text-void" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-bold text-2xl text-white mb-1">Staff Operations</h1>
          <p className="text-[11px] font-mono text-gold-500/70 tracking-[0.2em] uppercase">
            POUR
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-card">
          <div className="h-[2px] w-full bg-gold-grad" />
          <div className="p-5 space-y-5">

            <div>
              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-3">
                Who are you?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {STAFF_NAMES.map(n => (
                  <button
                    key={n}
                    onClick={() => setSelected(n)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-3.5 rounded-xl border text-sm font-body font-medium transition-all active:scale-95",
                      selected === n
                        ? "bg-gold-400/15 border-gold-400/30 text-gold-300"
                        : "bg-raised border-border text-slate-300 hover:border-rim hover:text-white",
                    )}
                  >
                    <User size={14} className="flex-shrink-0" />
                    <span className="truncate">{n}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selected}
              className={cn(
                "w-full py-3.5 rounded-xl font-body font-bold text-base flex items-center justify-center gap-2",
                "transition-all active:scale-[0.98]",
                selected
                  ? "bg-gold-grad text-void shadow-[0_2px_16px_rgba(201,160,48,0.3)] hover:brightness-110"
                  : "bg-raised border border-border text-slate-600 cursor-not-allowed",
              )}
            >
              Start Shift
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-600 font-mono mt-4">
          Your name will appear on all order actions during this session.
        </p>
      </div>
    </div>
  );
}
