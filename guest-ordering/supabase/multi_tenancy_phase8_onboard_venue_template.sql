-- ============================================================================
-- Multi-tenancy Phase 8 — venue #2 onboarding template.
--
-- DO NOT RUN until Phases 1, 3, 4, 5 are all live and confirmed (see the
-- plan / phase files) — specifically, do not insert step 4's event_settings
-- row until every app-code path is confirmed off the old `id = 1` lookup,
-- or that path will silently start reading whichever row has literal PK 1
-- instead of the intended venue's row (a silent cross-venue leak, not a
-- loud failure).
--
-- Fill in every <PLACEHOLDER> before running. Run as one transaction so a
-- mistake partway through doesn't leave a half-onboarded venue behind.
-- ============================================================================

BEGIN;

-- 1. Create the venue — note the returned id, needed for every step below.
INSERT INTO public.venues (id, name, accent_color)
VALUES (gen_random_uuid(), '<VENUE 2 NAME>', '<#RRGGBB>')
RETURNING id;

-- Copy the returned id and substitute it for every <VENUE2_ID> below, or
-- rerun this whole file with a fixed id instead of gen_random_uuid() if you
-- prefer to know it in advance:
--   INSERT INTO public.venues (id, name, accent_color)
--   VALUES ('<a-fixed-uuid-you-choose>', '<VENUE 2 NAME>', '<#RRGGBB>');

-- 2. Create its locations. Use a distinct id prefix (e.g. "v2-") so these
-- never collide with venue #1's existing loc-01..loc-05 style ids — guest
-- URLs are unchanged (/order/<location-id>), so whatever id you pick here
-- is exactly what goes on the new QR codes.
INSERT INTO public.locations (id, name, section, floor, is_active, venue_id) VALUES
  ('<v2-loc-01>', '<Location Name>', '<Section>', 1, true, '<VENUE2_ID>');
  -- add one row per location

-- 3. Seed its beverage menu — same shape as the existing "add a drink via
-- SQL" convention, one row per drink, every row tagged with venue_id.
INSERT INTO public.beverages (
  id, name, tagline, description, category, emoji, price,
  is_alcoholic, is_available, is_featured, is_signature, is_vip,
  prep_minutes, tags, venue_id
) VALUES (
  '<drink-id>', '<Drink Name>', '<tagline>', '<description>',
  '<cocktail|beer|wine|spirit|champagne|shot|non-alcoholic>', '<emoji>', 0,
  true, true, false, false, false,
  5, ARRAY[]::text[], '<VENUE2_ID>'
);
  -- add one row per drink

-- 4. One event_settings row for this venue — operational fields only
-- (venue_name/accent_color no longer live here, see venues above).
--
-- IMPORTANT: event_settings.id is `smallint DEFAULT 1` — a literal
-- default, not a sequence (confirmed via the Phase 0 diagnostic). Venue
-- #1's existing row already occupies id=1, so this INSERT must supply an
-- explicit, unused id or it will collide on the primary key. Check what
-- ids already exist first:
--   SELECT id, venue_id FROM public.event_settings ORDER BY id;
-- then pick the next free small integer (e.g. 2 for the first additional
-- venue) below.
INSERT INTO public.event_settings (id, venue_id, july4_surcharge_enabled, giant_cups_available)
VALUES (<NEXT_FREE_ID>, '<VENUE2_ID>', false, 0);

COMMIT;

-- ============================================================================
-- After running the SQL above, finish onboarding manually in the Supabase
-- Dashboard (Authentication → Users) — same steps as the original
-- multi_tenancy_phase1a_schema.sql account-binding pass:
--
--   1. Create (or invite) this venue's staff/admin Supabase Auth accounts.
--   2. Set app_metadata.role  → "staff" or "admin" (never "platform_admin"
--      for a venue-specific account — that role is reserved for Justin's
--      cross-venue account).
--   3. Set app_metadata.venue_id → the new venue's id from step 1 above.
--   4. Set app_metadata.display_name → their name, so staff-dashboard's
--      StaffLogin picker is skipped for them (see StaffLogin.tsx).
--   5. Double-check none of these accounts accidentally got
--      role: "platform_admin" — confirm the role value directly in the
--      Dashboard before moving on.
--   6. Generate and print/laminate new QR codes for each new location id
--      from step 2 above (guest URL: /order/<location-id>, unchanged
--      structure — this is the only physical-asset step).
-- ============================================================================
