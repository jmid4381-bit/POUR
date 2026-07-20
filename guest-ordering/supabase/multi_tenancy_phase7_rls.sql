-- ============================================================================
-- Multi-tenancy Phase 7 — enable RLS, venue-scoped for authenticated users.
--
-- REVISED after seeing the real Phase 0 diagnostic output (2026-07-20).
-- Two things changed from the first draft, both important:
--
-- 1. RLS was ALREADY enabled on every table, with existing policies —
--    almost all of them `USING (true)` for `authenticated`, and several
--    (staff_zones, zone_requests) even grant `anon` full read+write.
--    Postgres RLS policies are PERMISSIVE by default and OR'd together —
--    a wide-open policy sitting next to a new scoped one grants the wide
--    access regardless of the new one. So this file now explicitly DROPs
--    every pre-existing over-broad policy by its real name before creating
--    the replacement. Do not run this against a table without first
--    confirming (via _multi_tenancy_phase0_diagnostic.sql's pg_policies
--    query) that the DROP list below still matches what's actually there —
--    if Justin has added/renamed policies since 2026-07-20, this file is
--    stale and needs re-diffing against fresh output first.
--
-- 2. Found two pre-existing gaps UNRELATED to multi-tenancy while reading
--    the real policy list, fixed here since they're directly adjacent
--    (an anon direct insert into orders with no/wrong venue_id would
--    corrupt data even after migration):
--      - `anon_insert_orders` / `anon_insert_order_items` let anon INSERT
--        directly into orders/order_items, completely bypassing
--        submit_order (server-authoritative pricing, rate limit, cooldown,
--        giant-cup check). submit_order is SECURITY DEFINER and writes
--        these tables itself regardless of RLS, so anon never needed
--        direct INSERT — dropping it closes a real bypass, not just a
--        multi-tenancy nicety. Flagging this explicitly since it's a
--        scope addition beyond pure venue isolation — mention it to
--        Justin before running, don't just silently fix it.
--      - `event_settings.id` is `smallint DEFAULT 1` (a literal, not a
--        sequence) — multi_tenancy_phase8's onboarding template has been
--        corrected to pass an explicit id per venue instead of relying on
--        the default, which would otherwise collide on venue #2's insert.
--
-- Anon policies on beverages/locations are LEFT ALONE (not touched by this
-- file at all) — they're already `USING (true)`, which is what
-- lib/pricing.ts and the guest menu actually need (unavailable beverages
-- must still be readable so the UI can show them as "sold out" rather than
-- hiding them; a locked-down `is_available = true` predicate, which an
-- earlier draft of this file had, would have been a real regression).
--
-- DO NOT RUN THIS YET. Ship last, only after ALL of the following are true:
--   1. multi_tenancy_phase1a_schema.sql + phase1b_notnull.sql are both run
--      and confirmed (venue_id is NOT NULL everywhere it needs to be).
--   2. multi_tenancy_phase3_submit_order.sql is live, AND lib/pricing.ts's
--      event_settings reads have been switched to
--      get_event_settings_for_location (see note below — required before
--      event_settings_public_read is dropped, or pricing.ts's surcharge/
--      giant-cup checks silently stop seeing any row).
--   3. Every staff/admin Supabase Auth account has app_metadata.venue_id
--      (and Justin's has role: "platform_admin") set, AND everyone has
--      signed out and back in at least once since (JWT claims are stale
--      until a fresh sign-in/token refresh).
--   4. All three Vercel apps have deployed the venue_id query filtering
--      (Phase 5 app-code changes) and it's confirmed working in prod
--      against the single existing venue with zero behavior change.
--
-- ROLLBACK (paste this if anything breaks after running the file below —
-- restores the exact pre-existing wide-open policies this file drops, so
-- behavior reverts to today's, not to "no access"):
--
--   CREATE POLICY authenticated_all_beverages ON public.beverages FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY authenticated_all_locations ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY authenticated_read_orders ON public.orders FOR SELECT TO authenticated USING (true);
--   CREATE POLICY authenticated_update_orders ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY anon_insert_orders ON public.orders FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY authenticated_read_order_items ON public.order_items FOR SELECT TO authenticated USING (true);
--   CREATE POLICY anon_insert_order_items ON public.order_items FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY event_settings_public_read ON public.event_settings FOR SELECT TO public USING (true);
--   CREATE POLICY event_settings_admin_write ON public.event_settings FOR UPDATE TO public USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
--   CREATE POLICY "staff_zones read" ON public.staff_zones FOR SELECT TO anon, authenticated USING (true);
--   CREATE POLICY "staff_zones write" ON public.staff_zones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "zone_requests read" ON public.zone_requests FOR SELECT TO anon, authenticated USING (true);
--   CREATE POLICY "zone_requests write" ON public.zone_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
--   CREATE POLICY "Staff and admin can insert zone requests" ON public.zone_requests FOR INSERT TO authenticated WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['staff'::text, 'admin'::text]));
--   (then drop this file's replacement policies + venues policies, or just
--    DISABLE ROW LEVEL SECURITY on the affected tables as a bigger hammer)
--
-- WHY: real venue isolation for AUTHENTICATED staff/admin sessions (the
-- actual threat model that matters — a venue-A account querying the
-- Supabase client directly and pulling venue-B's orders, bypassing an
-- app-level filtering bug). Guests (anon key, no JWT identity) cannot be
-- venue-scoped by RLS at all — that boundary is, and stays, enforced
-- inside SECURITY DEFINER RPCs (submit_order etc.), same as today.
-- ============================================================================

-- ── helper functions ─────────────────────────────────────────────────────
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

-- ── orders ────────────────────────────────────────────────────────────────
-- (RLS already enabled — not re-run here.)

DROP POLICY IF EXISTS authenticated_read_orders   ON public.orders;
DROP POLICY IF EXISTS authenticated_update_orders ON public.orders;
-- Security fix, not just multi-tenancy: closes a direct anon bypass of
-- submit_order's server-authoritative validation. See file header.
DROP POLICY IF EXISTS anon_insert_orders ON public.orders;

DROP POLICY IF EXISTS orders_select_authenticated ON public.orders;
CREATE POLICY orders_select_authenticated ON public.orders
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id());

-- staff-dashboard writes order status directly (accept/preparing/ready/
-- deliver/cancel are all supabase.from("orders").update(...), not an RPC).
DROP POLICY IF EXISTS orders_update_authenticated ON public.orders;
CREATE POLICY orders_update_authenticated ON public.orders
FOR UPDATE TO authenticated
USING (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
WITH CHECK (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id());
-- No INSERT policy for anon or authenticated — submit_order (SECURITY
-- DEFINER, bypasses RLS) is now the ONLY writer of new order rows.

-- ── order_items ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS authenticated_read_order_items ON public.order_items;
-- Same bypass-closing fix as orders above.
DROP POLICY IF EXISTS anon_insert_order_items ON public.order_items;

-- No venue_id column on this table by design (see plan) — always read
-- nested under its parent order via a PostgREST embed, never queried
-- independently. Scope via EXISTS to the parent order's venue instead.
DROP POLICY IF EXISTS order_items_select_authenticated ON public.order_items;
CREATE POLICY order_items_select_authenticated ON public.order_items
FOR SELECT TO authenticated
USING (
  public.jwt_is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.venue_id = public.jwt_venue_id()
  )
);
-- No write policy — only submit_order (SECURITY DEFINER) writes this table.

-- ── beverages ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS authenticated_all_beverages ON public.beverages;

DROP POLICY IF EXISTS beverages_select_authenticated ON public.beverages;
CREATE POLICY beverages_select_authenticated ON public.beverages
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id());

DROP POLICY IF EXISTS beverages_write_admin ON public.beverages;
CREATE POLICY beverages_write_admin ON public.beverages
FOR ALL TO authenticated
USING (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
)
WITH CHECK (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
);

-- `anon_read_beverages` (anon, SELECT, true) is left exactly as-is — guests
-- need to see unavailable beverages too (shown as "sold out" in the UI,
-- not hidden), and anon has no venue claim to scope by regardless.

-- ── locations ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS authenticated_all_locations ON public.locations;

DROP POLICY IF EXISTS locations_select_authenticated ON public.locations;
CREATE POLICY locations_select_authenticated ON public.locations
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id());
-- No write policy for authenticated — no in-app location management exists
-- today (confirmed by audit); Justin manages locations via SQL as postgres,
-- which bypasses RLS entirely regardless of policies.

-- `anon_read_locations` / `locations_public_read` (anon+public, SELECT,
-- true) left exactly as-is — the guest client needs to read venue_id off
-- the location row itself to resolve "which venue is this" (see Phase 5/6
-- app wiring), and there's no venue claim to scope anon by anyway.

-- ── event_settings ───────────────────────────────────────────────────────
-- IMPORTANT: do not run this section until lib/pricing.ts's two direct
-- `.from("event_settings")` reads (surcharge check, giant-cup check) have
-- been switched to the get_event_settings_for_location RPC — those reads
-- run under the anon role (server-side, but still the anon key/JWT), and
-- dropping event_settings_public_read below will make them silently see
-- no row, which fails the surcharge/giant-cup logic open/closed in ways
-- that haven't been re-verified against this change.
DROP POLICY IF EXISTS event_settings_public_read ON public.event_settings;
DROP POLICY IF EXISTS event_settings_admin_write ON public.event_settings;

DROP POLICY IF EXISTS event_settings_select_authenticated ON public.event_settings;
CREATE POLICY event_settings_select_authenticated ON public.event_settings
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id());

DROP POLICY IF EXISTS event_settings_write_admin ON public.event_settings;
CREATE POLICY event_settings_write_admin ON public.event_settings
FOR UPDATE TO authenticated
USING (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
)
WITH CHECK (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
);
-- No anon policy at all — guest reads go through get_event_settings_for_location
-- (SECURITY DEFINER, see phase3 file), never a direct table read.

-- ── staff_zones ──────────────────────────────────────────────────────────
-- Real gap closed here (not just tightened): anon currently has FULL
-- read+write on this table via "staff_zones read"/"staff_zones write".
-- guest-ordering never touches staff_zones at all — anon needs zero access.
DROP POLICY IF EXISTS "staff_zones read"  ON public.staff_zones;
DROP POLICY IF EXISTS "staff_zones write" ON public.staff_zones;

DROP POLICY IF EXISTS staff_zones_select_authenticated ON public.staff_zones;
CREATE POLICY staff_zones_select_authenticated ON public.staff_zones
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id());

DROP POLICY IF EXISTS staff_zones_write_admin ON public.staff_zones;
CREATE POLICY staff_zones_write_admin ON public.staff_zones
FOR ALL TO authenticated
USING (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
)
WITH CHECK (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
);

-- ── zone_requests ────────────────────────────────────────────────────────
-- Same real gap as staff_zones: anon currently has full read+write via
-- "zone_requests read"/"zone_requests write". guest-ordering never touches
-- zone_requests either — anon needs zero access here too.
DROP POLICY IF EXISTS "zone_requests read"  ON public.zone_requests;
DROP POLICY IF EXISTS "zone_requests write" ON public.zone_requests;
-- Existing role-scoped insert policy predates venue_id — replaced with a
-- venue-aware version below.
DROP POLICY IF EXISTS "Staff and admin can insert zone requests" ON public.zone_requests;

DROP POLICY IF EXISTS zone_requests_select_authenticated ON public.zone_requests;
CREATE POLICY zone_requests_select_authenticated ON public.zone_requests
FOR SELECT TO authenticated
USING (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id());

-- Any signed-in staff/admin can submit their own request, scoped to their
-- own venue (or any venue for platform_admin).
DROP POLICY IF EXISTS zone_requests_insert_authenticated ON public.zone_requests;
CREATE POLICY zone_requests_insert_authenticated ON public.zone_requests
FOR INSERT TO authenticated
WITH CHECK (
  public.jwt_role() = ANY (ARRAY['staff', 'admin', 'platform_admin'])
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
);

-- Only admin/platform_admin resolves (approves/denies) a request.
DROP POLICY IF EXISTS zone_requests_update_admin ON public.zone_requests;
CREATE POLICY zone_requests_update_admin ON public.zone_requests
FOR UPDATE TO authenticated
USING (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
)
WITH CHECK (
  public.jwt_is_admin_or_platform()
  AND (public.jwt_is_platform_admin() OR venue_id = public.jwt_venue_id())
);

-- ── venues ───────────────────────────────────────────────────────────────
-- (ENABLE ROW LEVEL SECURITY already ran in phase1a_schema.sql; no
-- pre-existing policies were found on this table in the Phase 0 diagnostic
-- since it didn't exist before this migration — nothing to drop.)

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
-- No anon policy — guest branding reads go through
-- get_event_settings_for_location, never a direct venues table read.
-- No INSERT/DELETE policy for anyone — venue #2 onboarding (Phase 8) is
-- run by Justin as postgres via SQL Editor, which bypasses RLS entirely.

-- ============================================================================
-- NOT touched by this file, flagged for awareness rather than fixed here:
--   - `audit_log` table (authenticated_insert_audit_log/authenticated_read_
--     audit_log) — wasn't in the original Phase 0 table list, has no
--     venue_id column, and isn't scoped by this migration at all. A
--     venue-A admin can currently read venue-B's audit log entries once
--     venue 2 exists. Low severity (audit trail, not operational data) but
--     worth a follow-up pass before onboarding a second real paying
--     customer, not before then.
--   - `staff_dismissed_orders` — venue_id was added and backfilled in
--     Phase 1 but is nullable/best-effort by design (cosmetic declutter
--     feature only); its existing policy (`staff_dismissed_orders_rw`,
--     authenticated-only, no anon access) already excludes anon and was
--     left untouched here.
-- ============================================================================
