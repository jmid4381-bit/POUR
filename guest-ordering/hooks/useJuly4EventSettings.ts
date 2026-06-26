"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export const JULY4_SURCHARGE_DELAY_MS = 2 * 60_000; // TESTING — revert to 60 * 60_000 before the event starts
const POLL_MS = 15_000;

export interface July4EventSettings {
  startedAt: string | null;
  enabled:   boolean;
}

// Shared read of the event_settings singleton row — both the surcharge
// check and the milestone countdown derive from this same poll so there's
// only one Supabase round trip per guest, not one per consumer.
export function useJuly4EventSettings(): July4EventSettings {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [enabled,   setEnabled]   = useState(false);

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

  return { startedAt, enabled };
}
