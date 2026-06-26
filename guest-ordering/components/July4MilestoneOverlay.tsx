"use client";

/**
 * July4MilestoneOverlay — full-screen, auto-dismissing countdown
 * notifications toward the July 4th alcohol surcharge. See
 * hooks/useJuly4Milestones for the timing/queueing logic; this component
 * is purely presentational.
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJuly4Milestones } from "@/hooks/useJuly4Milestones";
import { Fireworks } from "./Fireworks";

interface July4MilestoneOverlayProps {
  // True whenever the guest is in an active modal/checkout flow — the
  // overlay holds off rendering entirely until this goes false.
  suppressed: boolean;
}

export function July4MilestoneOverlay({ suppressed }: July4MilestoneOverlayProps) {
  const display = useJuly4Milestones(suppressed);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (!display) return null;

  const isCountdown = display.kind === "countdown";
  const isFinal     = display.kind === "final";
  const showFirework = !reducedMotion && (isCountdown || isFinal);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-void/92 backdrop-blur-md animate-fade-in"
      role="status"
      aria-live="polite"
    >
      {showFirework && (
        <Fireworks key={isCountdown ? `tick-${display.seconds}` : "final"} />
      )}

      <div
        className={cn(
          "text-center px-8 animate-scale-in",
          isFinal && "border-2 border-gold-500/40 rounded-3xl py-10 px-10 bg-card/90 shadow-modal max-w-sm",
        )}
      >
        {isFinal ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gold-grad mx-auto mb-5 flex items-center justify-center shadow-btn-gold">
              <Sparkles size={28} className="text-void" />
            </div>
            <p className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug">
              {display.label}
            </p>
          </>
        ) : isCountdown ? (
          <>
            <p
              className="font-display font-black leading-none bg-gradient-to-r from-red-400 via-mist-50 to-blue-400 bg-clip-text text-transparent"
              style={{ fontSize: "min(38vw, 200px)" }}
            >
              {display.seconds}
            </p>
            <p className="mt-2 text-sm font-mono text-mist-300 uppercase tracking-widest">
              seconds until $3 surcharge
            </p>
          </>
        ) : (
          <p className="font-display text-2xl sm:text-3xl font-semibold leading-snug bg-gradient-to-r from-red-400 via-mist-50 to-blue-400 bg-clip-text text-transparent">
            {display.label}
          </p>
        )}
      </div>
    </div>
  );
}
