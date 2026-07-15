-- ============================================================================
-- Rate limiting (2026-07-15 audit, Part 1) — guest-scoped order rate limit
-- + push-subscription cap. Run this in the Supabase SQL Editor with the
-- Role dropdown set to `postgres`. Idempotent (IF NOT EXISTS / CREATE OR
-- REPLACE), safe to re-run.
--
-- WHY: the only rate limiting that existed before this was an in-memory,
-- per-IP limiter on the Next.js /api/orders route. Every one of these apps
-- ships the public Supabase anon key in client JS (no service-role key
-- anywhere in this project), so anyone can call submit_order directly
-- against Supabase, completely bypassing that route and its limiter. This
-- moves the real enforcement into submit_order itself, where it can't be
-- routed around — the same pattern already proven for the alcohol cooldown.
-- ============================================================================

-- One row per SUCCESSFUL order, server-timestamped. Used only to answer
-- "how many orders has this guest placed in the last N seconds" — NOT an
-- audit log, so no cleanup job is needed at this scale (single venue,
-- 40-100 guests/event keeps this table tiny).
CREATE TABLE IF NOT EXISTS public.guest_order_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guest_id     text        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_order_attempts_guest_id_idx
  ON public.guest_order_attempts (guest_id, attempted_at);

-- Lock the table: RLS on, NO policies — only submit_order (SECURITY DEFINER)
-- ever touches it, same lockdown pattern as pending_orders/push_subscriptions.
ALTER TABLE public.guest_order_attempts ENABLE ROW LEVEL SECURITY;

-- ── submit_order — unchanged except for the new guest-rate-limit guard ──────
-- Everything else (idempotency, availability check, alcohol cooldown re-check,
-- surcharge recompute, atomic giant-cup check+decrement, server-authoritative
-- item pricing) is byte-for-byte the same as the current live function.
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

  -- (A) Availability — every item must map to an available beverage.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    LEFT JOIN beverages b ON b.id = item->>'beverage_id'
    WHERE b.id IS NULL OR b.is_available = false
  ) THEN
    RAISE EXCEPTION 'ITEM_UNAVAILABLE';
  END IF;

  -- Alcoholic quantity in this order (quantity clamped 1..8 server-side).
  SELECT COALESCE(SUM(LEAST(8, GREATEST(1, (item->>'quantity')::int))), 0)
  INTO v_alcoholic_qty
  FROM jsonb_array_elements(p_items) AS item
  JOIN beverages b ON b.id = item->>'beverage_id'
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

  -- (C) Surcharge — recomputed from event_settings, ignoring client values.
  SELECT july4_started_at, july4_surcharge_enabled
  INTO v_started, v_enabled
  FROM event_settings
  WHERE id = 1;

  IF v_alcoholic_qty > 0
     AND COALESCE(v_enabled, false) = true
     AND v_started IS NOT NULL
     AND (now() - v_started) >= c_surcharge_delay
  THEN
    v_surcharge := c_surcharge_amt;
    v_label     := c_surcharge_label;
  END IF;

  -- Insert the order with the RECOMPUTED surcharge.
  INSERT INTO orders (
    id, location_id, location_name, section, floor,
    estimated_minutes, status, placed_at,
    age_verified, age_bracket, age_verified_at, guest_id, guest_name,
    surcharge_amount, surcharge_label
  ) VALUES (
    p_id, p_location_id, p_location_name, p_section, p_floor,
    p_estimated_minutes, p_status, p_placed_at,
    p_age_verified, p_age_bracket, p_age_verified_at, p_guest_id, p_guest_name,
    v_surcharge, v_label
  )
  ON CONFLICT (id) DO NOTHING;

  -- If a concurrent duplicate beat us to it, stop here (don't double-process).
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- (D) Giant cups — detected only from the "(Giant)" name suffix (the sole
  -- client signal). Atomic check+decrement in one locked UPDATE closes the
  -- race and enforces the cap; failure rolls back the whole order.
  SELECT COALESCE(SUM(LEAST(8, GREATEST(1, (item->>'quantity')::int))), 0)
  INTO v_giant_count
  FROM jsonb_array_elements(p_items) AS item
  WHERE (item->>'beverage_name') LIKE '% (Giant)';

  IF v_giant_count > 0 THEN
    UPDATE event_settings
    SET giant_cups_available = giant_cups_available - v_giant_count
    WHERE id = 1
      AND COALESCE(giant_cups_available, 0) >= v_giant_count;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'GIANT_CUPS_UNAVAILABLE';
    END IF;
  END IF;

  -- Items with SERVER-AUTHORITATIVE name and price. Client unit_price and
  -- beverage_name are ignored except for reading the "(Giant)" size signal.
  INSERT INTO order_items (order_id, beverage_id, beverage_name, unit_price, quantity, note)
  SELECT
    p_id,
    b.id,
    b.name || CASE WHEN (item->>'beverage_name') LIKE '% (Giant)' THEN ' (Giant)' ELSE '' END,
    b.price + CASE WHEN (item->>'beverage_name') LIKE '% (Giant)' THEN c_giant_upcharge ELSE 0 END,
    LEAST(8, GREATEST(1, (item->>'quantity')::int)),
    LEFT(item->>'note', 200)
  FROM jsonb_array_elements(p_items) AS item
  JOIN beverages b ON b.id = item->>'beverage_id';

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
-- of who calls it, which is why the rate limit had to move INTO it).
GRANT EXECUTE ON FUNCTION public.submit_order(text, text, text, text, integer, integer, text, timestamp with time zone, boolean, text, timestamp with time zone, jsonb, text, text, numeric, text) TO anon;
