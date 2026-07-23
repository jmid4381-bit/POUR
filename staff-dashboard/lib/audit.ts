import { supabase } from "./supabase";
import { logError } from "./logger";

// Records who did what and when, for accountability and dispute resolution.
// Writes go through the log_audit_event SECURITY DEFINER RPC — actor_email
// and venue_id are both derived server-side from the caller's own JWT, never
// trusted from the client, same lockdown pattern as orders/pending_orders.
// venueId is only actually used for a platform_admin caller (who has no
// venue pinned to their own JWT); for regular staff/admin it's ignored
// server-side in favor of their real jwt_venue_id().
//
// Never throws — a logging failure should never block the actual operation,
// but IS worth knowing about, so it's reported to Sentry.
export async function logAudit(
  action:      string,
  targetTable: string,
  targetId:    string,
  details?:    Record<string, unknown>,
  venueId?:    string | null,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_audit_event", {
      p_action:       action,
      p_target_table: targetTable,
      p_target_id:    targetId,
      p_details:      details ?? null,
      p_venue_id:     venueId ?? null,
    });
    if (error) {
      logError("Audit log write failed", new Error(error.message), { action, targetTable, targetId });
    }
  } catch (err) {
    logError("Audit log write threw", err, { action, targetTable, targetId });
  }
}
