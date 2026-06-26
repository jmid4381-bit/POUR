"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export const JULY4_SURCHARGE_AMOUNT = 3;
export const JULY4_SURCHARGE_LABEL  = "4th of July Hour Surcharge";
const JULY4_SURCHARGE_DELAY_MS      = 2 * 60_000; // TESTING — revert to 60 * 60_000 before the event starts
const POLL_MS                       = 15_000;

// Mirrors the server-side check in app/api/orders/route.ts, so the cart can
// show/hide the surcharge line live as the guest edits their order — the
// API route remains the real authority on what actually gets charged.
export function useJuly4Surcharge() {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [enabled,   setEnabled]   = useState(false);
  const [isActive,  setIsActive]  = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("event_settings")
      .select("july4_started_at, july4_surcharge_enabled")
      .eq("id", 1)
      .maybeSingle();
    setStartedAt(data?.july4_started_at ?? null);
    setEnabled(Boolean(data?.july4_surcharge_enabled));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

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
