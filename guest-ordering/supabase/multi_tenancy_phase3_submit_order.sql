-- ============================================================================
-- Multi-tenancy Phase 3 — submit_order becomes venue-aware.
-- Run this AFTER multi_tenancy_phase1a_schema.sql (needs the nullable
-- venue_id columns to exist) and BEFORE multi_tenancy_phase1b_notnull.sql's
-- NOT NULL lock-in — this function works fine against nullable columns.
--
-- WHAT CHANGED vs. the current live function (rate_limiting.sql): venue_id
-- is derived server-side from p_location_id (never a client-supplied
-- parameter — that would let a malicious client target another venue's
-- inventory/surcharge/order log directly). Threaded into: the beverage
-- availability/price join, the event_settings surcharge lookup, the giant
-- cup decrement, and the orders insert. Everything else — idempotency,
-- rate limit, alcohol cooldown, item pricing — is untouched.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_order(p_id text, p_location_id text, p_location_name text, p_section text, p_floor integer, p_estimated_minutes integer, p_status text, p_placed_at timestamp with time zone, p_age_verified boolean, p_age_bracket text, p_age_verified_at timestamp with time zone, p_items jsonb, p_guest_id text DEFAULT NULL::text, p_guest_name text DEFAULT NULL::text, p_surcharge_amount numeric DEFAULT 0, p_surcharge_label text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_giant_upcharge  constant numeric  := 1;
  c_surcharge_amt   constant numeric  := 3;
  c_surcharge_label constant text     := '4th of July Post Hour Surcharge';
  c_surcharge_delay constant interval := interval '60 minutes';
  c_alcohol_window  constant integer  := 10;  -- minutes
  c_max_alcoholic   constant integer  := 2;
  c_rate_limit      constant integer  := 5;   -- max orders per guest...
  c_rate_window      constant interval := interval '60 seconds'; -- ...per this window

  v_venue_id      uuid;
  v_alcoholic_qty integer;
  v_giant_count   integer;
  v_consumed      integer;
  v_oldest        timestamptz;
  v_room          integer;
  v_started       timestamptz;
  v_enabled       boolean;
  v_surcharge     numeric := 0;
  v_label         text    := NULL;
  v_recent_orders integer;
BEGIN
  -- Idempotency: duplicate/retry of an existing order id is a safe no-op.
  -- (Also prevents a legit retry from tripping the checks below on an order
  -- that already counts against the guest's own cooldown / cup inventory.)
  IF EXISTS (SELECT 1 FROM orders WHERE id = p_id) THEN
    RETURN;
  END IF;

  -- (NEW) Derive venue_id from the location itself — never trust a client-
  -- supplied venue. p_location_id is already required/validated below by
  -- every downstream lookup; an unknown location is a hard reject.
  SELECT venue_id INTO v_venue_id FROM locations WHERE id = p_location_id;
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'UNKNOWN_LOCATION';
  END IF;

  -- (0) Guest-scoped rate limit — closes the gap where this RPC is
  -- anon-callable directly, bypassing the Next.js route's IP-based limiter
  -- entirely. Keyed by the guest-id cookie (not p_placed_at, which is
  -- client-supplied and could be backdated to dodge a client-timestamp
  -- check) against guest_order_attempts, a server-timestamped ledger.
  IF p_guest_id IS NOT NULL THEN
    SELECT count(*) INTO v_recent_orders
    FROM guest_order_attempts
    WHERE guest_id = p_guest_id AND attempted_at > now() - c_rate_window;

    IF v_recent_orders >= c_rate_limit THEN
      RAISE EXCEPTION 'RATE_LIMITED';
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_ORDER';
  END IF;

  -- (A) Availability — every item must map to an available beverage IN
  -- THIS VENUE. A beverage id belonging to another venue now fails the
  -- join (b.id IS NULL) exactly like an unknown/unavailable id would —
  -- defense in depth on top of the app-layer venue filtering, closing the
  -- gap where a guest could otherwise craft a request referencing another
  -- venue's beverage id directly.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    LEFT JOIN beverages b ON b.id = item->>'beverage_id' AND b.venue_id = v_venue_id
    WHERE b.id IS NULL OR b.is_available = false
  ) THEN
    RAISE EXCEPTION 'ITEM_UNAVAILABLE';
  END IF;

  -- Alcoholic quantity in this order (quantity clamped 1..8 server-side).
  SELECT COALESCE(SUM(LEAST(8, GREATEST(1, (item->>'quantity')::int))), 0)
  INTO v_alcoholic_qty
  FROM jsonb_array_elements(p_items) AS item
  JOIN beverages b ON b.id = item->>'beverage_id' AND b.venue_id = v_venue_id
  WHERE b.is_alcoholic = true;

  -- (B) Alcohol cooldown re-check — 2 drinks / 10 min per guest cookie id.
  -- Must run BEFORE inserting this order so it isn't counted against itself.
  IF v_alcoholic_qty > 0 AND p_guest_id IS NOT NULL THEN
    SELECT consumed, oldest_at
    INTO v_consumed, v_oldest
    FROM get_guest_alcohol_status(p_guest_id, c_alcohol_window);

    v_room := GREATEST(0, c_max_alcoholic - COALESCE(v_consumed, 0));
    IF v_alcoholic_qty > v_room THEN
      RAISE EXCEPTION 'ALCOHOL_LIMIT_EXCEEDED';
    END IF;
  END IF;

  -- (C) Surcharge — recomputed from THIS VENUE's event_settings row,
  -- ignoring client values.
  SELECT july4_started_at, july4_surcharge_enabled
  INTO v_started, v_enabled
  FROM event_settings
  WHERE venue_id = v_venue_id;

  IF v_alcoholic_qty > 0
     AND COALESCE(v_enabled, false) = true
     AND v_started IS NOT NULL
     AND (now() - v_started) >= c_surcharge_delay
  THEN
    v_surcharge := c_surcharge_amt;
    v_label     := c_surcharge_label;
  END IF;

  -- Insert the order with the RECOMPUTED surcharge and derived venue_id.
  INSERT INTO orders (
    id, location_id, location_name, section, floor,
    estimated_minutes, status, placed_at,
    age_verified, age_bracket, age_verified_at, guest_id, guest_name,
    surcharge_amount, surcharge_label, venue_id
  ) VALUES (
    p_id, p_location_id, p_location_name, p_section, p_floor,
    p_estimated_minutes, p_status, p_placed_at,
    p_age_verified, p_age_bracket, p_age_verified_at, p_guest_id, p_guest_name,
    v_surcharge, v_label, v_venue_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- If a concurrent duplicate beat us to it, stop here (don't double-process).
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- (D) Giant cups — detected only from the "(Giant)" name suffix (the sole
  -- client signal). Atomic check+decrement in one locked UPDATE, scoped to
  -- THIS VENUE's row, closes the race and enforces the cap; failure rolls
  -- back the whole order.
  SELECT COALESCE(SUM(LEAST(8, GREATEST(1, (item->>'quantity')::int))), 0)
  INTO v_giant_count
  FROM jsonb_array_elements(p_items) AS item
  WHERE (item->>'beverage_name') LIKE '% (Giant)';

  IF v_giant_count > 0 THEN
    UPDATE event_settings
    SET giant_cups_available = giant_cups_available - v_giant_count
    WHERE venue_id = v_venue_id
      AND COALESCE(giant_cups_available, 0) >= v_giant_count;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'GIANT_CUPS_UNAVAILABLE';
    END IF;
  END IF;

  -- Items with SERVER-AUTHORITATIVE name and price, from THIS VENUE's
  -- beverage catalog only. Client unit_price and beverage_name are ignored
  -- except for reading the "(Giant)" size signal.
  INSERT INTO order_items (order_id, beverage_id, beverage_name, unit_price, quantity, note)
  SELECT
    p_id,
    b.id,
    b.name || CASE WHEN (item->>'beverage_name') LIKE '% (Giant)' THEN ' (Giant)' ELSE '' END,
    b.price + CASE WHEN (item->>'beverage_name') LIKE '% (Giant)' THEN c_giant_upcharge ELSE 0 END,
    LEAST(8, GREATEST(1, (item->>'quantity')::int)),
    LEFT(item->>'note', 200)
  FROM jsonb_array_elements(p_items) AS item
  JOIN beverages b ON b.id = item->>'beverage_id' AND b.venue_id = v_venue_id;

  -- Log this SUCCESSFUL order for the rate limiter above. Placed last, after
  -- every check has passed — if anything above raises, Postgres rolls back
  -- the whole function call including this insert, so a failed/rejected
  -- attempt never counts against the guest.
  IF p_guest_id IS NOT NULL THEN
    INSERT INTO guest_order_attempts (guest_id) VALUES (p_guest_id);
  END IF;
END;
$function$;

-- Grant unchanged — same signature, still anon-callable (that's the actual
-- authority model here; the RPC re-validates everything itself regardless
-- of who calls it, venue included).
GRANT EXECUTE ON FUNCTION public.submit_order(text, text, text, text, integer, integer, text, timestamp with time zone, boolean, text, timestamp with time zone, jsonb, text, text, numeric, text) TO anon;

-- ── get_event_settings_for_location — new guest-facing RPC ─────────────
-- Anon has no venue JWT claim (guests aren't authenticated Supabase users),
-- so once event_settings has more than one row, a direct anon SELECT can
-- no longer safely assume "the row" the way `.eq('id', 1)` did. This wraps
-- the lookup in a SECURITY DEFINER RPC keyed by p_location_id (which the
-- guest already legitimately has, from the URL) — the same pattern already
-- used for get_guest_age_status/get_guest_alcohol_status.
CREATE OR REPLACE FUNCTION public.get_event_settings_for_location(p_location_id text)
RETURNS TABLE (
  venue_name             text,
  accent_color           text,
  july4_started_at       timestamptz,
  july4_surcharge_enabled boolean,
  giant_cups_available   integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.name, v.accent_color,
         es.july4_started_at, es.july4_surcharge_enabled, es.giant_cups_available
  FROM locations l
  JOIN venues v ON v.id = l.venue_id
  JOIN event_settings es ON es.venue_id = l.venue_id
  WHERE l.id = p_location_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_settings_for_location(text) TO anon;

-- ============================================================================
-- increment_giant_cup — CONFIRMED against the real function body via the
-- Phase 0 diagnostic (2026-07-20). Real prior definition was:
--
--   CREATE OR REPLACE FUNCTION public.increment_giant_cup()
--   RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
--   BEGIN
--     UPDATE event_settings
--     SET giant_cups_available = LEAST(4, giant_cups_available + 1)
--     WHERE id = 1;
--   END;
--   $function$
--
-- Only change: takes a required p_venue_id, sourced app-side from the
-- caller's own JWT venue claim (staff-dashboard, never client-editable —
-- see staff-dashboard/lib/currentVenue.ts), and filters by venue_id
-- instead of the old hardcoded id = 1.
--
-- Old signature had zero args; this is a different function signature in
-- Postgres (overloading by arg count), so the old zero-arg version keeps
-- existing unless explicitly dropped. Drop it once staff-dashboard's
-- updated call site (passing p_venue_id) is confirmed deployed, so nothing
-- can silently call the old un-scoped version by accident:
--   DROP FUNCTION IF EXISTS public.increment_giant_cup();
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_giant_cup(p_venue_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE event_settings
  SET giant_cups_available = LEAST(4, giant_cups_available + 1)
  WHERE venue_id = p_venue_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_giant_cup(uuid) TO authenticated;
