"use client";

/**
 * LiveTimer — reads from the global ClockContext (single interval for the
 * whole dashboard) instead of creating its own setInterval.
 *
 * Also implements Fix 5 — graduated urgency with 4 visual levels:
 *   fresh (0-4:59)  → neutral
 *   caution (5-7:59) → amber
 *   urgent  (8-9:59) → orange
 *   overdue (10+)    → red + blink
 */

import { cn } from "@/lib/utils";
import { useClock } from "@/contexts/ClockContext";
import { getUrgency } from "@/lib/types";
import type { OrderStatus } from "@/lib/types";

interface LiveTimerProps {
  placedAt: string;
  status:   OrderStatus;
  size?:    "sm" | "md";
}

function formatDuration(seconds: number): string {
  if (seconds < 0)  return "0s";
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) {
    const s = seconds % 60;
    return `${totalMinutes}m ${s.toString().padStart(2, "0")}s`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export function LiveTimer({ placedAt, status, size = "md" }: LiveTimerProps) {
  // Single subscription to global clock tick (not its own interval)
  const tick    = useClock();
  const placed  = Math.floor(new Date(placedAt).getTime() / 1000);
  const elapsed = Math.max(0, tick - placed);

  // For completed orders, show final elapsed time without live updates
  const isLive  = status === "pending" || status === "accepted" || status === "ready";

  // Fix 5 — graduated urgency
  const urgency = getUrgency(placedAt, status);

  const colorClass =
    urgency === "overdue"  ? "text-red-400 animate-blink"     :
    urgency === "urgent"   ? "text-orange-400"                 :
    urgency === "caution"  ? "text-amber-400"                  :
    status  === "delivered"? "text-emerald-500/60"             :
    status  === "ready"    ? "text-violet-400"                 :
    "text-slate-300";

  return (
    <span className={cn(
      "font-mono tabular-nums font-semibold tracking-tight transition-colors duration-500",
      size === "sm" ? "text-xs" : "text-sm",
      colorClass,
    )}>
      {formatDuration(elapsed)}
      {urgency === "overdue" && (
        <span className="ml-1 text-[9px] font-mono text-red-500 uppercase tracking-wider">
          LATE
        </span>
      )}
      {urgency === "urgent" && (
        <span className="ml-1 text-[9px] font-mono text-orange-500 uppercase tracking-wider">
          SOON
        </span>
      )}
    </span>
  );
}
