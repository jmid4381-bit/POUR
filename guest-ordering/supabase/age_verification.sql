-- ============================================================================
-- Age verification server-side logging + enforcement (2026-07-15 audit)
-- Run this in the Supabase SQL Editor with the Role dropdown set to
-- `postgres`. Idempotent (IF NOT EXISTS / CREATE OR REPLACE), safe to re-run.
--
-- WHY: previously the age gate was entirely client-side (sessionStorage /
-- localStorage) — nothing about a guest's age verification reached the
-- server unless they went on to place an order, and even then the
-- ageBracket/ageVerifiedAt sent with the order was just trusted, never
-- checked against whether the order actually contained alcohol. This adds
-- a real server-side record (never the birthdate, only a bracket + a
-- SERVER-set timestamp) and uses it to reject alcoholic items for a
-- guest whose most recent verification says they're under 21.
--
-- HONEST LIMIT: this is still fundamentally a self-reported birthdate —
-- there's no ID scan behind it. What this closes is the *accidental or
-- casual* bypass (disabling JS, editing browser storage, hitting the API
-- directly without going through the gate) and creates a real audit trail.
-- The actual compliance backstop remains staff checking ID at delivery.
-- ============================================================================

-- Append-only audit log, one row per verification event (birthdate submit,
-- or an explicit "Yes, that's me" reconfirmation). Never the birthdate
-- itself — only the same coarse bracket already used client-side, plus a
-- server-set timestamp (NOT client-supplied, so it can't be backdated).
CREATE TABLE IF NOT EXISTS public.guest_age_verifications (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guest_id     text        NOT NULL,
  age_bracket  text        NOT NULL,
  is_underage  boolean     NOT NULL,
  verified_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_age_verifications_guest_id_idx
  ON public.guest_age_verifications (guest_id, verified_at DESC);

-- Lock the table: RLS on, NO policies — only the SECURITY DEFINER functions
-- below can read/write it, same pattern as every other guest-facing table.
ALTER TABLE public.guest_age_verifications ENABLE ROW LEVEL SECURITY;

-- Records one verification event. Called by app/api/age-verify/route.ts
-- right after the guest submits the age gate (or reconfirms "Yes, that's
-- me") — fire-and-forget from the guest's point of view.
CREATE OR REPLACE FUNCTION public.record_age_verification(
  p_guest_id    text,
  p_age_bracket text,
  p_is_underage boolean
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.guest_age_verifications (guest_id, age_bracket, is_underage)
  VALUES (p_guest_id, p_age_bracket, p_is_underage);
$$;

-- Returns the guest's MOST RECENT verification outcome (or no rows if
-- they've never verified — e.g. the logging call failed, or they're mid
-- age-gate flow). computeOrderCharge uses this to decide whether to allow
-- alcoholic items, mirroring exactly how the existing alcohol-cooldown
-- check (get_guest_alcohol_status) already looks up guest state server-side
-- instead of trusting a client-supplied flag.
CREATE OR REPLACE FUNCTION public.get_guest_age_status(p_guest_id text)
RETURNS TABLE (is_underage boolean, verified_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT is_underage, verified_at
  FROM public.guest_age_verifications
  WHERE guest_id = p_guest_id
  ORDER BY verified_at DESC
  LIMIT 1;
$$;

-- The app connects with the anon key (no service-role key anywhere in this
-- project), so grant EXECUTE on both RPCs to anon — same as every other
-- guest-facing RPC in this schema.
GRANT EXECUTE ON FUNCTION public.record_age_verification(text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.get_guest_age_status(text)                  TO anon;

-- Optional sanity check — should return both function names:
-- SELECT proname FROM pg_proc WHERE proname IN ('record_age_verification','get_guest_age_status');
