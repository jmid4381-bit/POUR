-- ============================================================================
-- Phase 2 push notifications — push_subscriptions table + RPCs
-- Run this in the Supabase SQL Editor with the Role dropdown set to `postgres`.
-- Everything is idempotent (IF NOT EXISTS / CREATE OR REPLACE), safe to re-run.
-- ============================================================================

-- One row per device subscription, tied to the order it should alert on.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      text        NOT NULL,
  guest_id      text,
  endpoint      text        NOT NULL UNIQUE,   -- push endpoint = the device
  subscription  jsonb       NOT NULL,          -- full PushSubscription JSON
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_order_id_idx
  ON public.push_subscriptions (order_id);

-- Lock the table: RLS on, NO policies — only the SECURITY DEFINER functions
-- below can read/write it (same pattern as pending_orders).
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Upsert a subscription (a device re-opening the page re-subscribes with the
-- same endpoint; keep the latest order/keys for it).
CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_order_id     text,
  p_guest_id     text,
  p_endpoint     text,
  p_subscription jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.push_subscriptions (order_id, guest_id, endpoint, subscription)
  VALUES (p_order_id, p_guest_id, p_endpoint, p_subscription)
  ON CONFLICT (endpoint) DO UPDATE
    SET order_id     = EXCLUDED.order_id,
        guest_id     = EXCLUDED.guest_id,
        subscription = EXCLUDED.subscription,
        created_at   = now();
$$;

-- Read the subscriptions to notify for an order (used by the notify webhook).
CREATE OR REPLACE FUNCTION public.get_push_subscriptions_for_order(p_order_id text)
RETURNS TABLE (endpoint text, subscription jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT endpoint, subscription
  FROM public.push_subscriptions
  WHERE order_id = p_order_id;
$$;

-- Remove a dead subscription (push service returned 404/410 Gone).
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
$$;

-- The app connects with the anon key, so grant EXECUTE on the RPCs to anon.
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.get_push_subscriptions_for_order(text)          TO anon;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text)                  TO anon;

-- Optional sanity check — should return all three function names:
-- SELECT proname FROM pg_proc
-- WHERE proname IN ('save_push_subscription','get_push_subscriptions_for_order','delete_push_subscription');
