-- ============================================================================
-- Multi-tenancy Phase 0 — diagnostic only, makes NO changes.
-- Run this in the Supabase SQL Editor (Role: postgres) and paste the full
-- output back. This tells us (a) which tables currently have RLS enabled
-- and what policies (if any) already exist, and (b) the exact current body
-- of every SECURITY DEFINER function that isn't tracked in this repo's SQL
-- files, so later phases can produce real diffs instead of guessed rewrites.
-- ============================================================================

-- (a) RLS status on every table the multi-tenancy plan touches.
SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN (
  'locations', 'beverages', 'orders', 'order_items', 'event_settings',
  'staff_zones', 'zone_requests', 'staff_dismissed_orders'
)
ORDER BY relname;

-- (b) Any existing policies on those tables (expected: none, but confirm).
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- (c) Full source of every SECURITY DEFINER RPC referenced from app code
-- that has no tracked .sql file in this repo. Needed before Phase 3 touches
-- any of these — especially create_pending_order/mark_pending_order, which
-- sit on the Stripe payment path.
SELECT proname AS function_name, pg_get_functiondef(oid) AS full_definition
FROM pg_proc
WHERE proname IN (
  'increment_giant_cup',
  'get_guest_alcohol_status',
  'get_order_status',
  'get_order_staff_name',
  'get_guest_orders',
  'create_pending_order',
  'get_pending_order',
  'mark_pending_order',
  'set_order_payment_intent'
)
ORDER BY proname;

-- (d) Columns actually present on the core tables today (confirms/corrects
-- what app code implies about beverages/locations/event_settings/orders).
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('locations', 'beverages', 'orders', 'order_items', 'event_settings')
ORDER BY table_name, ordinal_position;
