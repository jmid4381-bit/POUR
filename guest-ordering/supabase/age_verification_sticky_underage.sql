-- ============================================================================
-- Age verification: sticky underage flag (2026-07-23 security audit fix)
-- Run this in the Supabase SQL Editor with the Role dropdown set to
-- `postgres`. Idempotent (CREATE OR REPLACE), safe to re-run.
--
-- THE BUG: get_guest_age_status returned whichever guest_age_verifications
-- row was MOST RECENT for a guest_id. Since record_age_verification is a
-- public, unauthenticated, unrated endpoint (app/api/age-verify/route.ts)
-- that accepts a client-declared is_underage boolean with no proof of
-- actual age, a guest verified as underage could immediately call the same
-- endpoint again claiming is_underage: false — the new row became the
-- "most recent" one, and the block silently lifted. Proven live during a
-- security audit: verify(true) -> order blocked (403) -> verify(false) ->
-- identical order succeeded (200), no re-check of anything in between.
--
-- THE FIX: once ANY row for a guest_id has is_underage = true, that guest
-- is treated as underage forever (bool_or across every row, not just the
-- latest). record_age_verification still inserts every event unchanged —
-- the append-only audit trail is preserved, including the bypass attempt
-- itself, which is now visible in guest_age_verifications instead of
-- silently overriding the record ahead of it.
--
-- HONEST LIMIT (unchanged from the original migration): this is still a
-- self-reported birthdate with no ID scan behind it. What this closes is a
-- guest un-flagging themselves after an honest underage submission — not
-- a guest lying about their age on the very first attempt. The real
-- compliance backstop remains staff checking ID at delivery.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_guest_age_status(p_guest_id text)
RETURNS TABLE (is_underage boolean, verified_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT bool_or(is_underage) AS is_underage, max(verified_at) AS verified_at
  FROM public.guest_age_verifications
  WHERE guest_id = p_guest_id
  HAVING count(*) > 0;
$$;

-- Sanity check — should show is_underage = true even after a later false
-- row for the same guest_id (safe to delete this test guest_id afterward):
-- SELECT record_age_verification('audit-sticky-test', 'under_legal_age', true);
-- SELECT record_age_verification('audit-sticky-test', '25-34', false);
-- SELECT * FROM get_guest_age_status('audit-sticky-test'); -- expect is_underage = true
-- DELETE FROM guest_age_verifications WHERE guest_id = 'audit-sticky-test';
