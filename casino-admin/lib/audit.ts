import { supabase } from "./supabase";
import { logError } from "./logger";

// Records who did what and when, for accountability and dispute resolution.
// Never throws — a logging failure should never block the actual operation.
// (Also never surfaces to the admin — this is purely a background record —
// but a failure here IS worth knowing about, so it's reported to Sentry:
// previously this was silently unrecoverable, since Supabase's insert()
// doesn't throw on a query error, so the try/catch never even caught
// anything — the `{ error }` result was simply discarded.)
export async function logAudit(
  action:      string,
  targetTable: string,
  targetId:    string,
  details?:    Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("audit_log").insert({
      actor_email:  user?.email ?? "unknown",
      action,
      target_table: targetTable,
      target_id:    targetId,
      details:      details ?? null,
    });
    if (error) {
      logError("Audit log write failed", new Error(error.message), { action, targetTable, targetId });
    }
  } catch (err) {
    logError("Audit log write threw", err, { action, targetTable, targetId });
  }
}
