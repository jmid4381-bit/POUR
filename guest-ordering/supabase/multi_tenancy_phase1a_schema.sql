-- ============================================================================
-- Multi-tenancy Phase 1a — venues table + nullable venue_id columns + backfill
-- Run this in the Supabase SQL Editor (Role: postgres). Idempotent, safe to
-- re-run. Adds columns as NULLABLE on purpose — do NOT run
-- multi_tenancy_phase1b_notnull.sql until the verification query at the
-- bottom of this file returns all zeros.
--
-- WHY: first real step toward multi-venue support. Every existing row
-- belongs to today's single venue, so this creates that venue as a real row
-- and backfills every table to point at it — zero behavior change, just
-- makes the "one venue" implicit today into an explicit, extensible fact.
-- ============================================================================

-- ── venues ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venues (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  accent_color text NOT NULL DEFAULT '#C9A030' CHECK (accent_color ~* '^#[0-9a-fA-F]{6}$'),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed venue for the current single-tenant deployment. Fixed, well-known
-- UUID (not gen_random_uuid()) so every backfill statement below is
-- copy-pasteable without first looking up a generated id.
INSERT INTO public.venues (id, name, accent_color)
VALUES ('00000000-0000-0000-0000-000000000001', 'POUR', '#C9A030')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- ── venue_id columns, nullable for now ──────────────────────────────────
ALTER TABLE public.locations             ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id);
ALTER TABLE public.beverages             ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id);
ALTER TABLE public.orders                ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id);
ALTER TABLE public.event_settings        ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id);
ALTER TABLE public.staff_zones           ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id);
ALTER TABLE public.zone_requests         ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id);
ALTER TABLE public.staff_dismissed_orders ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id);

-- ── backfill everything to the seed venue ───────────────────────────────
UPDATE public.locations      SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE public.beverages      SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE public.orders         SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE public.event_settings SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;

-- staff_zones/zone_requests/staff_dismissed_orders derive venue via their
-- location/order reference rather than the hardcoded seed id directly, so
-- this stays correct even if run after some rows already point elsewhere.
UPDATE public.staff_zones sz
SET venue_id = l.venue_id
FROM public.locations l
WHERE sz.location_id = l.id AND sz.venue_id IS NULL;

UPDATE public.zone_requests zr
SET venue_id = l.venue_id
FROM public.locations l
WHERE zr.requested_zone_id = l.id AND zr.venue_id IS NULL;

UPDATE public.staff_dismissed_orders sdo
SET venue_id = o.venue_id
FROM public.orders o
WHERE sdo.order_id = o.id AND sdo.venue_id IS NULL;

-- ── verification — every row below must read 0 before running phase1b ───
SELECT 'locations' AS table_name, count(*) AS null_venue_id_rows FROM public.locations WHERE venue_id IS NULL
UNION ALL SELECT 'beverages', count(*) FROM public.beverages WHERE venue_id IS NULL
UNION ALL SELECT 'orders', count(*) FROM public.orders WHERE venue_id IS NULL
UNION ALL SELECT 'event_settings', count(*) FROM public.event_settings WHERE venue_id IS NULL
UNION ALL SELECT 'staff_zones', count(*) FROM public.staff_zones WHERE venue_id IS NULL
UNION ALL SELECT 'zone_requests', count(*) FROM public.zone_requests WHERE venue_id IS NULL
UNION ALL SELECT 'staff_dismissed_orders', count(*) FROM public.staff_dismissed_orders WHERE venue_id IS NULL;
