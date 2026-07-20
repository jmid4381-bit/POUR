"use client";

import { useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  getSessionVenueId, isPlatformAdmin, getSessionDisplayName,
  getStoredSwitcherVenueId, setStoredSwitcherVenueId,
} from "@/lib/currentVenue";

export interface VenueOption {
  id:   string;
  name: string;
}

// Resolves "which venue is this signed-in staff member operating in" —
// AuthGate already gated on role, this layer adds the venue dimension.
// Regular staff/admin accounts are pinned to their own app_metadata.venue_id.
// platform_admin (Justin) has no fixed venue and picks one via a switcher;
// the choice is remembered per-tab (sessionStorage) but never persisted
// server-side, so a fresh session always starts unselected.
export function useSessionVenue() {
  const [session, setSession] = useState<Session | null>(null);
  const [venues,  setVenues]  = useState<VenueOption[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const platformAdmin = isPlatformAdmin(session);

  useEffect(() => {
    if (!platformAdmin) return;
    supabase.from("venues").select("id, name").order("name").then(({ data }) => {
      if (data) setVenues(data);
    });
    const stored = getStoredSwitcherVenueId();
    if (stored) setSelectedVenueId(stored);
  }, [platformAdmin]);

  const chooseVenue = useCallback((venueId: string) => {
    setSelectedVenueId(venueId);
    setStoredSwitcherVenueId(venueId);
  }, []);

  const venueId = platformAdmin ? selectedVenueId : getSessionVenueId(session);
  const displayName = getSessionDisplayName(session);

  return {
    session,
    venueId,
    displayName,
    isPlatformAdmin: platformAdmin,
    venues,
    selectedVenueId,
    chooseVenue,
    // platform_admin with nothing picked yet — every venue-scoped query
    // should hold off until this resolves, same as the loading state.
    resolving: platformAdmin && !selectedVenueId,
  };
}
