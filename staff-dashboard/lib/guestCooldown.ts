import { supabase } from "./supabase";

/**
 * Reads the SAME server-side cooldown the guest ordering app enforces and
 * displays — calls the identical get_guest_alcohol_status RPC, no separate
 * formula or timer logic. This is read-only context for staff; it cannot
 * drift from the real enforcement because it IS the real enforcement.
 */

const ALCOHOL_WINDOW_MINUTES   = 10;
const MAX_ALCOHOLIC_PER_WINDOW = 2;

// Returns the epoch ms when this guest's cooldown clears, or null if
// they're not currently in one.
export async function readGuestCooldownExpiry(guestId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc("get_guest_alcohol_status", {
      p_guest_id: guestId,
      p_window_minutes: ALCOHOL_WINDOW_MINUTES,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const consumed: number = row?.consumed ?? 0;
    const oldestAt: string | null = row?.oldest_at ?? null;

    if (consumed < MAX_ALCOHOLIC_PER_WINDOW || !oldestAt) return null;
    return new Date(oldestAt).getTime() + ALCOHOL_WINDOW_MINUTES * 60_000;
  } catch {
    return null;
  }
}
