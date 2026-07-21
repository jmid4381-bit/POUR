-- ============================================================================
-- Fix — a device can only ever track ONE order's push notifications at a time.
-- Run in the Supabase SQL Editor with Role: postgres. Idempotent.
--
-- ROOT CAUSE: push_subscriptions.endpoint (one row per device) was UNIQUE on
-- its own, and save_push_subscription's ON CONFLICT (endpoint) DO UPDATE
-- rewrites that SAME row's order_id every time the guest (re-)subscribes.
-- Placing a second order on the same device doesn't add a subscription --
-- it silently REBINDS the device's one-and-only row from the first order to
-- the second. When the first order later reaches "preparing"/"ready"/
-- "delivered", the notify webhook looks up subscriptions for that order,
-- finds zero rows (they were reassigned), and sends nothing.
--
-- FIX: a device can be subscribed to MULTIPLE orders at once -- uniqueness
-- moves from (endpoint) alone to (endpoint, order_id), so each order this
-- guest places on this device gets its own row instead of sharing one.
-- ============================================================================

-- Drop the old device-only uniqueness. Constraint name matches Postgres's
-- default naming for a column-level UNIQUE (verify with the query at the
-- bottom of this file if this doesn't exist under this exact name).
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;

-- New composite uniqueness: one row per (device, order) pair.
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_order_id_key;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_order_id_key UNIQUE (endpoint, order_id);

CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_order_id     text,
  p_guest_id     text,
  p_endpoint     text,
  p_subscription jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cap constant int := 5;
BEGIN
  INSERT INTO public.push_subscriptions (order_id, guest_id, endpoint, subscription)
  VALUES (p_order_id, p_guest_id, p_endpoint, p_subscription)
  ON CONFLICT (endpoint, order_id) DO UPDATE
    SET guest_id     = EXCLUDED.guest_id,
        subscription = EXCLUDED.subscription,
        created_at   = now();

  -- Cap at 5 concurrent order-subscriptions per guest (was "5 devices" under
  -- the old one-row-per-device model; now "5 rows", i.e. up to 5 orders
  -- being tracked at once across however many devices). Rewritten to key
  -- off the row id instead of endpoint -- the old
  -- "WHERE endpoint IN (... beyond top 5 ...)" form would now delete EVERY
  -- row sharing an over-the-cap endpoint (i.e. all of that device's order
  -- subscriptions at once) instead of just the specific excess rows, since
  -- multiple rows can now legitimately share the same endpoint.
  IF p_guest_id IS NOT NULL THEN
    DELETE FROM public.push_subscriptions
    WHERE id IN (
      SELECT id FROM public.push_subscriptions
      WHERE guest_id = p_guest_id
      ORDER BY created_at DESC
      OFFSET v_cap
    );
  END IF;
END;
$$;

-- get_push_subscriptions_for_order and delete_push_subscription need no
-- change -- both already operate per-row (order_id filter, endpoint filter
-- respectively), which is exactly correct once each order has its own row.

-- Sanity checks:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.push_subscriptions'::regclass;
--   -> should show push_subscriptions_endpoint_order_id_key, NOT a
--      standalone endpoint unique constraint.
-- SELECT order_id, guest_id, endpoint, created_at FROM public.push_subscriptions ORDER BY created_at DESC LIMIT 20;
--   -> after this fix, placing 2 orders on the same device/guest should
--      show 2 separate rows with the same endpoint but different order_id.
