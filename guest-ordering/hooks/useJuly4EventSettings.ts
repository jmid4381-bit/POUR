"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ⚠️ TEMPORARY TEST VALUE — set to 2 minutes to verify the countdown
// notifications (2 min / 1 min / final 10s / final message) fire correctly.
// REVERT to `60 * 60_000` (1 hour) before the live event.
export const JULY4_SURCHARGE_DELAY_MS = 2 * 60_000;
const POLL_MS = 15_000;

export const GIANT_CUP_MAX = 4;

export interface July4EventSettings {
  startedAt:           string | null;
  enabled:             boolean;
  giantCupsAvailable:  number;
}

// Shared read of the event_settings singleton row — both the surcharge
// check and the milestone countdown derive from this same poll so there's
// only one Supabase round trip per guest, not one per consumer.
export function useJuly4EventSettings(): July4EventSettings {
  const [startedAt,          setStartedAt]          = useState<string | null>(null);
  const [enabled,            setEnabled]             = useState(false);
  const [giantCupsAvailable, setGiantCupsAvailable] = useState(GIANT_CUP_MAX);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("event_settings")
      .select("july4_started_at, july4_surcharge_enabled, giant_cups_available")
      .eq("id", 1)
      .maybeSingle();
    setStartedAt(data?.july4_started_at ?? null);
    setEnabled(Boolean(data?.july4_surcharge_enabled));
    if (typeof data?.giant_cups_available === "number") {
      setGiantCupsAvailable(data.giant_cups_available);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { startedAt, enabled, giantCupsAvailable };
}
