import { supabase } from "./supabase";

// Records who did what and when, for accountability and dispute resolution.
// Never throws — a logging failure should never block the actual operation.
export async function logAudit(
  action:      string,
  targetTable: string,
  targetId:    string,
  details?:    Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      actor_email:  user?.email ?? "unknown",
      action,
      target_table: targetTable,
      target_id:    targetId,
      details:      details ?? null,
    });
  } catch {
    // Logging is best-effort — never let it break a staff action
  }
}
