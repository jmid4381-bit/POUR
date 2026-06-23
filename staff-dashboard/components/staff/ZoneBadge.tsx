"use client";

/**
 * ZoneBadge — Fix 10: location scannability.
 *
 * Replaces the unreadable small-text "section · floor" line with a
 * high-contrast coloured pill that runners can identify from across
 * a station without reading full text.
 *
 * VIP · F3   SLOTS · F1   TABLE E · F1   POKER · F2
 */

import { cn } from "@/lib/utils";
import { getZone } from "@/lib/types";

interface ZoneBadgeProps {
  section: string;
  floor:   number;
  size?:   "sm" | "md";
}

export function ZoneBadge({ section, floor, size = "sm" }: ZoneBadgeProps) {
  const zone = getZone(section);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-mono font-bold uppercase tracking-wider rounded-lg border flex-shrink-0",
      size === "sm"  ? "text-[9px] px-1.5 py-0.5"  : "text-[10px] px-2 py-1",
      zone.color, zone.bg, zone.border,
    )}>
      {zone.short}
      <span className="opacity-60">·</span>
      F{floor}
    </span>
  );
}
