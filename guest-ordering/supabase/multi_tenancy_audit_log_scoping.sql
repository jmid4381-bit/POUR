-- ============================================================================
-- audit_log: venue scoping + tamper-resistant writes (2026-07-23 security audit fix)
-- Run this in the Supabase SQL Editor with the Role dropdown set to
-- `postgres`. Safe to re-run except the ADD COLUMN / DROP POLICY statements,
-- which are already guarded with IF NOT EXISTS / IF EXISTS.
--
-- THE BUG (found during a security audit, confirmed live via pg_policies):
--   - authenticated_read_audit_log had qual = true — any authenticated staff
--     or admin account, from ANY venue, could read every other venue's audit
--     history, including other venues' staff email addresses and action
--     details. The table had no venue_id column at all, so there was
--     nothing to scope by even if the policy had tried.
--   - authenticated_insert_audit_log had with_check = true, and the client
--     (lib/audit.ts) sent actor_email as a plain insert value rather than
--     something the database derived from the session — so any authenticated
--     account could, in principle, forge an audit_log row attributing an
--     action to a different email address, undermining the log's entire
--     purpose ("accountability and dispute resolution").
--
-- THE FIX:
--   1. Add venue_id, scope it via the same jwt_venue_id() pattern used
--      everywhere else in this schema.
--   2. Move writes behind a SECURITY DEFINER RPC (log_audit_event) that
--      derives BOTH venue_id and actor_email server-side from the caller's
--      own JWT — never trusts a client-supplied value for either. Regular
--      staff/admin always get their own jwt_venue_id(); platform_admin (who
--      has no venue pinned to their own JWT) may pass p_venue_id explicitly,
--      matching how the venue switcher already works elsewhere in the app.
--   3. Drop the old wide-open INSERT/SELECT policies. No direct INSERT
--      policy for authenticated at all — same "only a SECURITY DEFINER
--      function writes this table" pattern already used for orders,
--      pending_orders, and push_subscriptions in this codebase.
--   4. Pre-existing rows (written before this migration, with no venue_id)
--      stay readable only to platform_admin — there's no way to safely
--      attribute them to a venue after the fact.
-- ============================================================================

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS venue_id uuid;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action      text,
  p_target_table text,
  p_target_id   text,
  p_details     jsonb DEFAULT NULL,
  p_venue_id    uuid  DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  v_venue_id := CASE
    WHEN public.jwt_is_platform_admin() THEN p_venue_id
    ELSE public.jwt_venue_id()
  END;

  INSERT INTO public.audit_log (actor_email, action, target_table, target_id, details, venue_id)
  VALUES (
    auth.jwt() ->> 'email',
    p_action,
    p_target_table,
    p_target_id,
    p_details,
    v_venue_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, uuid) TO authenticated;

DROP POLICY IF EXISTS authenticated_insert_audit_log ON public.audit_log;
DROP POLICY IF EXISTS authenticated_read_audit_log    ON public.audit_log;

CREATE POLICY audit_log_select_authenticated ON public.audit_log
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR (venue_id = public.jwt_venue_id()));

-- No INSERT policy for authenticated — log_audit_event (SECURITY DEFINER,
-- bypasses RLS) is now the only writer, same pattern as orders/pending_orders.

-- Sanity check — should show only the venue-scoped SELECT policy, no INSERT:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'audit_log';
