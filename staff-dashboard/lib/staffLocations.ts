/**
 * lib/staffLocations.ts — which locations each staff member is responsible for.
 *
 * Simple, static config for a small test deployment — edit and redeploy to
 * change assignments. No database table or settings UI needed at this scale.
 *
 * Any location not listed for anyone here is shown to ALL staff as a
 * fallback, so an order can never go unseen just because nobody claimed
 * its location.
 */

export const STAFF_LOCATIONS: Record<string, string[]> = {
  Evan:   ["loc-01", "loc-02"],
  Justin: ["loc-03", "loc-04"],
};

const ALL_ASSIGNED_LOCATIONS = new Set(Object.values(STAFF_LOCATIONS).flat());

// True if this order's location should be visible to this staff member —
// either it's explicitly assigned to them, or nobody has claimed it.
export function isVisibleToStaff(locationId: string | undefined, staffName: string): boolean {
  if (!locationId) return true; // no location on the order — always show it, never hide
  const assignedTo = STAFF_LOCATIONS[staffName] ?? [];
  if (assignedTo.includes(locationId)) return true;
  return !ALL_ASSIGNED_LOCATIONS.has(locationId); // unclaimed location — visible to everyone
}
