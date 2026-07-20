import { supabase } from "./supabase";

export interface StaffLocation {
  id:      string;
  name:    string;
  section: string;
  floor:   number;
}

export async function fetchActiveLocations(venueId: string | null): Promise<StaffLocation[]> {
  if (!venueId) return [];
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, section, floor, is_active")
    .eq("is_active", true)
    .eq("venue_id", venueId)
    .order("id");

  if (error || !data) return [];
  return data.map(r => ({ id: r.id, name: r.name, section: r.section, floor: r.floor }));
}
