import type { Location, StaffZone, ZoneRequest, ZoneRequestType, ZoneRequestStatus } from "./types";

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface LocationRow {
  id:        string;
  name:      string;
  section:   string;
  floor:     number;
  is_active: boolean;
}

export interface StaffZoneRow {
  staff_name:  string;
  location_id: string;
}

export interface ZoneRequestRow {
  id:                 string;
  staff_name:         string;
  request_type:       ZoneRequestType;
  requested_zone_id:  string;
  status:             ZoneRequestStatus;
  created_at:         string;
  resolved_at:        string | null;
}

// ─── Row → app type ────────────────────────────────────────────────────────────

export function rowToLocation(row: LocationRow): Location {
  return { id: row.id, name: row.name, section: row.section, floor: row.floor, isActive: row.is_active };
}

export function rowToStaffZone(row: StaffZoneRow): StaffZone {
  return { staffName: row.staff_name, locationId: row.location_id };
}

export function rowToZoneRequest(row: ZoneRequestRow): ZoneRequest {
  return {
    id:              row.id,
    staffName:       row.staff_name,
    requestType:     row.request_type,
    requestedZoneId: row.requested_zone_id,
    status:          row.status,
    createdAt:       row.created_at,
    resolvedAt:      row.resolved_at ?? undefined,
  };
}
