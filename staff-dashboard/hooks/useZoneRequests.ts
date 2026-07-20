"use client";

/**
 * useZoneRequests — staff-side: submit a switch/add request, and watch
 * this staff member's own most recent request for an admin's decision in
 * real time (so the "pending" banner clears the instant it's approved or
 * denied, without polling).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { logMessage } from "@/lib/logger";

export type ZoneRequestType   = "switch" | "add";
export type ZoneRequestStatus = "pending" | "approved" | "denied";

export interface MyZoneRequest {
  id:               string;
  requestType:      ZoneRequestType;
  requestedZoneId:  string;
  status:           ZoneRequestStatus;
}

export function useZoneRequests(staffName: string, venueId: string | null) {
  const [latest,     setLatest]     = useState<MyZoneRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Always the CURRENT venueId -- discards a response that arrives after
  // the switcher has already moved to a different venue.
  const venueIdRef = useRef(venueId);
  venueIdRef.current = venueId;

  useEffect(() => { setLatest(null); }, [venueId]);

  const fetchLatest = useCallback(async () => {
    if (!venueId) { setLatest(null); return; }
    const requestedVenueId = venueId;
    const { data, error } = await supabase
      .from("zone_requests")
      .select("id, request_type, requested_zone_id, status")
      .eq("staff_name", staffName)
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (requestedVenueId !== venueIdRef.current) return;
    if (error || !data || data.length === 0) { setLatest(null); return; }
    const row = data[0];
    setLatest({
      id:              row.id,
      requestType:     row.request_type,
      requestedZoneId: row.requested_zone_id,
      status:          row.status,
    });
  }, [staffName, venueId]);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  useEffect(() => {
    if (!venueId) return;
    const channel = supabase
      .channel(`zone-requests-${staffName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zone_requests", filter: `staff_name=eq.${staffName}` },
        () => fetchLatest(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logMessage("Realtime subscription failed: zone-requests", { status, staffName });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [staffName, venueId, fetchLatest]);

  const submitRequest = useCallback(async (requestType: ZoneRequestType, requestedZoneId: string): Promise<boolean> => {
    if (!venueId) return false;
    setSubmitting(true);
    const { error } = await supabase.from("zone_requests").insert({
      staff_name:        staffName,
      request_type:      requestType,
      requested_zone_id: requestedZoneId,
      status:            "pending",
      venue_id:          venueId,
    });
    setSubmitting(false);
    if (!error) await fetchLatest();
    return !error;
  }, [staffName, venueId, fetchLatest]);

  // Lets the UI dismiss a resolved (approved/denied) request from view once
  // the staff member has seen it, so the banner doesn't linger forever.
  const acknowledge = useCallback(() => {
    setLatest(prev => (prev && prev.status !== "pending") ? null : prev);
  }, []);

  return { latest, submitting, submitRequest, acknowledge };
}
