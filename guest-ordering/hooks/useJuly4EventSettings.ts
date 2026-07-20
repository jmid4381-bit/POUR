"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export const JULY4_SURCHARGE_DELAY_MS = 60 * 60_000;
const POLL_MS = 15_000;

export const GIANT_CUP_MAX = 4;

// Multi-tenant fallback — shown whenever the venue hasn't set a name (or
// cleared it back to empty) for this deployment.
export const DEFAULT_VENUE_NAME = "POUR";
const DEFAULT_ACCENT = "#C9A030";

export interface July4EventSettings {
  startedAt:           string | null;
  enabled:             boolean;
  giantCupsAvailable:  number;
  venueName:           string;
  accentColor:         string;
}

// Shared read of this venue's event_settings row — the surcharge check, the
// milestone countdown, AND the venue branding all derive from this same
// poll so there's only one Supabase round trip per guest, not one per
// consumer. Keyed by locationId (the only venue identity anon has — see
// get_event_settings_for_location, guest-ordering/supabase/multi_tenancy_
// phase3_submit_order.sql) rather than a hardcoded singleton row.
export function useJuly4EventSettings(locationId?: string): July4EventSettings {
  const [startedAt,          setStartedAt]          = useState<string | null>(null);
  const [enabled,            setEnabled]             = useState(false);
  const [giantCupsAvailable, setGiantCupsAvailable] = useState(GIANT_CUP_MAX);
  const [venueName,          setVenueName]          = useState(DEFAULT_VENUE_NAME);
  const [accentColor,        setAccentColor]        = useState(DEFAULT_ACCENT);

  const refresh = useCallback(async () => {
    if (!locationId) return;
    const { data: rows, error } = await supabase
      .rpc("get_event_settings_for_location", { p_location_id: locationId });

    if (error || !rows) return;
    const data = (Array.isArray(rows) ? rows[0] : rows) as {
      july4_started_at:        string | null;
      july4_surcharge_enabled: boolean | null;
      giant_cups_available:    number | null;
      venue_name:              string | null;
      accent_color:            string | null;
    } | undefined;
    if (!data) return;

    setStartedAt(data.july4_started_at ?? null);
    setEnabled(Boolean(data.july4_surcharge_enabled));
    if (typeof data.giant_cups_available === "number") {
      setGiantCupsAvailable(data.giant_cups_available);
    }
    setVenueName((data.venue_name ?? "").trim() || DEFAULT_VENUE_NAME);
    setAccentColor(data.accent_color || DEFAULT_ACCENT);
  }, [locationId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { startedAt, enabled, giantCupsAvailable, venueName, accentColor };
}
