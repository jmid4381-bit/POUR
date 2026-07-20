-- ============================================================================
-- Multi-tenancy Phase 1b — lock down venue_id as NOT NULL + indexes.
--
-- DO NOT RUN THIS until multi_tenancy_phase1a_schema.sql's verification
-- query returned 0 for every table. Running this before every row is
-- backfilled will fail loudly (ALTER COLUMN ... SET NOT NULL errors if any
-- row is still NULL) — that's the intended safety behavior, not a bug.
-- ============================================================================

ALTER TABLE public.locations      ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE public.beverages      ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE public.orders         ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE public.event_settings ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE public.staff_zones    ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE public.zone_requests  ALTER COLUMN venue_id SET NOT NULL;
-- staff_dismissed_orders.venue_id stays nullable — best-effort/cosmetic
-- table only (dismissed-card declutter), not worth a hard failure mode.

-- event_settings becomes one-row-per-venue (replacing the old id=1 singleton).
CREATE UNIQUE INDEX IF NOT EXISTS event_settings_venue_id_key ON public.event_settings (venue_id);

CREATE INDEX IF NOT EXISTS idx_locations_venue_id      ON public.locations (venue_id);
CREATE INDEX IF NOT EXISTS idx_beverages_venue_id       ON public.beverages (venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_venue_id          ON public.orders (venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_zones_venue_id     ON public.staff_zones (venue_id);
CREATE INDEX IF NOT EXISTS idx_zone_requests_venue_id   ON public.zone_requests (venue_id);
