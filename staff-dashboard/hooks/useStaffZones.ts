"use client";

/**
 * useStaffZones — live (Supabase-backed) replacement for the old static
 * STAFF_LOCATIONS config. Reads the staff_zones table, which is now the
 * real-time source of truth for who's assigned to which location(s) — an
 * admin-approved zone request updates this table directly, so a switch
 * takes effect immediately for everyone watching, no redeploy required.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { logMessage } from "@/lib/logger";

interface StaffZoneRow {
  staff_name:  string;
  location_id: string;
}

export function useStaffZones(venueId: string | null) {
  const [rows,    setRows]    = useState<StaffZoneRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Always the CURRENT venueId -- discards a response that arrives after
  // the switcher has already moved to a different venue.
  const venueIdRef = useRef(venueId);
  venueIdRef.current = venueId;

  useEffect(() => { setRows([]); }, [venueId]);

  const fetchRows = useCallback(async () => {
    if (!venueId) { setRows([]); setLoading(false); return; }
    const requestedVenueId = venueId;
    const { data, error } = await supabase
      .from("staff_zones")
      .select("staff_name, location_id")
      .eq("venue_id", venueId);
    if (requestedVenueId !== venueIdRef.current) return;
    if (!error) setRows(data ?? []);
    setLoading(false);
  }, [venueId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    if (!venueId) return;
    const channel = supabase
      .channel(`staff-zones-changes-${venueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_zones", filter: `venue_id=eq.${venueId}` }, () => fetchRows())
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logMessage("Realtime subscription failed: staff-zones-changes", { status });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [fetchRows, venueId]);

  const byStaff = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!map.has(r.staff_name)) map.set(r.staff_name, new Set());
      map.get(r.staff_name)!.add(r.location_id);
    }
    return map;
  }, [rows]);

  const allAssigned = useMemo(() => new Set(rows.map(r => r.location_id)), [rows]);

  // Same contract as the old static isVisibleToStaff(locationId, staffName):
  // visible if it's explicitly assigned to this staff member, or if nobody
  // has claimed it (so an order never goes unseen).
  const isVisible = useCallback((locationId: string | undefined, staffName: string): boolean => {
    if (!locationId) return true;
    const mine = byStaff.get(staffName);
    if (mine?.has(locationId)) return true;
    return !allAssigned.has(locationId);
  }, [byStaff, allAssigned]);

  const zonesFor = useCallback((staffName: string): Set<string> => {
    return byStaff.get(staffName) ?? new Set();
  }, [byStaff]);

  return { loading, isVisible, zonesFor };
}
