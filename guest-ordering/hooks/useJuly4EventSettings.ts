"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export const JULY4_SURCHARGE_DELAY_MS = 60 * 60_000;
const POLL_MS = 15_000;

export const GIANT_CUP_MAX = 4;

// Multi-tenant fallback — shown whenever the venue hasn't set a name (or
// cleared it back to empty) for this deployment.
export const DEFAULT_VENUE_NAME = "POUR";

export interface July4EventSettings {
  startedAt:           string | null;
  enabled:             boolean;
  giantCupsAvailable:  number;
  venueName:           string;
}

// Shared read of the event_settings singleton row — the surcharge check,
// the milestone countdown, AND the venue branding all derive from this same
// poll so there's only one Supabase round trip per guest, not one per
// consumer.
export function useJuly4EventSettings(): July4EventSettings {
  const [startedAt,          setStartedAt]          = useState<string | null>(null);
  const [enabled,            setEnabled]             = useState(false);
  const [giantCupsAvailable, setGiantCupsAvailable] = useState(GIANT_CUP_MAX);
  const [venueName,          setVenueName]          = useState(DEFAULT_VENUE_NAME);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("event_settings")
      .select("july4_started_at, july4_surcharge_enabled, giant_cups_available, venue_name")
      .eq("id", 1)
      .maybeSingle();

    // PostgREST fails the WHOLE query if any requested column doesn't exist
    // yet (e.g. venue_name before its migration has been run on this
    // deployment). Fall back to the fields that do exist so a pending
    // migration can never take down the surcharge/giant-cup logic that
    // already depends on this same poll.
    if (error) {
      const { data: fallback } = await supabase
        .from("event_settings")
        .select("july4_started_at, july4_surcharge_enabled, giant_cups_available")
        .eq("id", 1)
        .maybeSingle();
      setStartedAt(fallback?.july4_started_at ?? null);
      setEnabled(Boolean(fallback?.july4_surcharge_enabled));
      if (typeof fallback?.giant_cups_available === "number") {
        setGiantCupsAvailable(fallback.giant_cups_available);
      }
      setVenueName(DEFAULT_VENUE_NAME);
      return;
    }

    setStartedAt(data?.july4_started_at ?? null);
    setEnabled(Boolean(data?.july4_surcharge_enabled));
    if (typeof data?.giant_cups_available === "number") {
      setGiantCupsAvailable(data.giant_cups_available);
    }
    setVenueName((data?.venue_name ?? "").trim() || DEFAULT_VENUE_NAME);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { startedAt, enabled, giantCupsAvailable, venueName };
}
