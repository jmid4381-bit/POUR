-- ============================================================================
-- Hotfix — venues table has RLS enabled (since phase1a) but no policies yet
-- (those were scoped into phase7, run separately/later). With RLS on and
-- zero policies, Postgres denies every role by default, so the
-- platform_admin venue switcher's `SELECT id, name FROM venues` comes back
-- empty — "No venues found" in both staff-dashboard and casino-admin.
--
-- Safe to run in isolation right now: venues is a brand-new table with no
-- pre-existing policies to worry about clobbering (unlike orders/beverages/
-- etc., which is why the rest of phase7 is still held back). This is the
-- exact same venues policy block that lives in multi_tenancy_phase7_rls.sql
-- — running it now just un-blocks the switcher early; running the full
-- phase7 file later will simply re-create these same two policies
-- (DROP IF EXISTS / CREATE, idempotent) alongside everything else.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.jwt_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

CREATE OR REPLACE FUNCTION public.jwt_venue_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'venue_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.jwt_role() = 'platform_admin';
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_admin_or_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.jwt_role() IN ('admin', 'platform_admin');
$$;

DROP POLICY IF EXISTS venues_select_authenticated ON public.venues;
CREATE POLICY venues_select_authenticated ON public.venues
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR id = public.jwt_venue_id());

DROP POLICY IF EXISTS venues_update_admin ON public.venues;
CREATE POLICY venues_update_admin ON public.venues
FOR UPDATE TO authenticated
USING (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR id = public.jwt_venue_id())
)
WITH CHECK (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR id = public.jwt_venue_id())
);
