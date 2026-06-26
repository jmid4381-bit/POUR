"use client";

import { useState, useEffect } from "react";
import { useJuly4EventSettings, JULY4_SURCHARGE_DELAY_MS } from "@/hooks/useJuly4EventSettings";

export const JULY4_SURCHARGE_AMOUNT = 3;
export const JULY4_SURCHARGE_LABEL  = "4th of July Post Hour Surcharge";

// Mirrors the server-side check in app/api/orders/route.ts, so the cart can
// show/hide the surcharge line live as the guest edits their order — the
// API route remains the real authority on what actually gets charged.
export function useJuly4Surcharge() {
  const { startedAt, enabled } = useJuly4EventSettings();
  const [isActive, setIsActive] = useState(false);

  // Recompute every second so the surcharge appears the instant the 1-hour
  // mark passes, without waiting on the next poll.
  useEffect(() => {
    const tick = () => {
      setIsActive(
        enabled && !!startedAt &&
        Date.now() - new Date(startedAt).getTime() >= JULY4_SURCHARGE_DELAY_MS,
      );
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [enabled, startedAt]);

  return isActive;
}
