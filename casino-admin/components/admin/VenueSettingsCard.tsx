"use client";

/**
 * VenueSettingsCard — multi-tenant branding control.
 *
 * Lets an admin set the venue name and accent color shown to guests
 * (ordering page) and staff (dashboard header) for this venue, without any
 * code change or redeploy. Backed by the `venues` table — one row per
 * venue, scoped to whichever venue this admin (or platform_admin via the
 * sidebar switcher) is currently viewing.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Building2, Save, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { getCachedVenueBranding, setCachedVenueBranding } from "@/lib/currentVenue";

const MAX_VENUE_NAME_LEN = 50;
export const DEFAULT_VENUE_NAME = "POUR";
const DEFAULT_ACCENT = "#C9A030";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const POLL_MS = 3_000;

export function VenueSettingsCard() {
  const { venueId } = useStore();
  // Lazy initializers -- seed from the cached last-known venue branding
  // (synchronous on first render) instead of the hardcoded POUR default,
  // so opening this card right after a refresh doesn't flash "POUR" while
  // the real fetch for the actual current venue is still in flight.
  const [savedName,   setSavedName]   = useState<string>(() => getCachedVenueBranding()?.name ?? DEFAULT_VENUE_NAME);
  const [savedAccent, setSavedAccent] = useState<string>(() => getCachedVenueBranding()?.accentColor ?? DEFAULT_ACCENT);
  const [draftName,   setDraftName]   = useState<string>(() => getCachedVenueBranding()?.name ?? "");
  const [draftAccent, setDraftAccent] = useState<string>(() => getCachedVenueBranding()?.accentColor ?? DEFAULT_ACCENT);
  const [loaded,     setLoaded]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Always the CURRENT venueId (updated synchronously during render) --
  // lets refresh() detect "the switcher moved on again while I was in
  // flight" and discard its own response, instead of flashing a stale
  // venue's branding over the one actually being viewed now.
  const venueIdRef = useRef(venueId);
  venueIdRef.current = venueId;

  // Which venue's data the draft fields were last seeded from. Distinct
  // from `loaded` (which only ever needed to be "seed once, then never
  // again during same-venue polling") -- this also re-seeds on a genuine
  // venue SWITCH, which the old loaded-boolean version didn't: `loaded`
  // stayed true forever after the very first mount, so switching venues
  // updated the "Live: X" badge (from savedName) but left the editable
  // Venue Name / Accent Color fields and the preview stuck on whichever
  // venue was loaded first.
  const seededVenueIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!venueId) return;
    const requestedVenueId = venueId;
    const { data } = await supabase
      .from("venues")
      .select("name, accent_color")
      .eq("id", venueId)
      .maybeSingle();

    if (requestedVenueId !== venueIdRef.current) return; // stale response, venue changed since request

    const name   = (data?.name ?? "").trim() || DEFAULT_VENUE_NAME;
    const accent = data?.accent_color && HEX_COLOR_RE.test(data.accent_color) ? data.accent_color : DEFAULT_ACCENT;
    setSavedName(name);
    setSavedAccent(accent);
    setCachedVenueBranding({ venueId: requestedVenueId, name, accentColor: accent });
    // Only re-seed the editable fields when this is a different venue than
    // last seeded -- a same-venue background poll shouldn't clobber
    // whatever the admin is actively typing, but a genuine venue switch
    // must always re-seed.
    if (seededVenueIdRef.current !== requestedVenueId) {
      seededVenueIdRef.current = requestedVenueId;
      setDraftName(name);
      setDraftAccent(accent);
    }
    setLoaded(true);
  }, [venueId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const trimmedDraftName = draftName.trim();
  const validAccent = HEX_COLOR_RE.test(draftAccent) ? draftAccent : null;
  const isDirty = loaded && (trimmedDraftName !== savedName || (validAccent ?? savedAccent) !== savedAccent);

  const handleSave = async () => {
    if (saving || !venueId || !validAccent) return;
    setSaving(true);
    const clean = trimmedDraftName.slice(0, MAX_VENUE_NAME_LEN) || DEFAULT_VENUE_NAME;
    await supabase
      .from("venues")
      .update({ name: clean, accent_color: validAccent })
      .eq("id", venueId);
    document.documentElement.style.setProperty("--venue-accent", validAccent);
    await refresh();
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  const previewName = trimmedDraftName || DEFAULT_VENUE_NAME;
  const previewAccent = validAccent ?? savedAccent;

  return (
    <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-gold-400" />
          <h2 className="font-display font-semibold text-white text-base">Venue Branding</h2>
        </div>
        {loaded && (
          <span className="text-[10px] font-mono font-bold rounded-full px-2 py-0.5 border text-ink-400 bg-raised border-edge">
            Live: {savedName}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-ink-400 text-xs font-body leading-relaxed">
          Shown to guests on the ordering page and to staff on their dashboard. Changes apply within
          seconds across every device — no redeploy needed.
        </p>

        <div>
          <label htmlFor="venue-name-input" className="text-[10px] font-mono text-ink-400 uppercase tracking-widest mb-1.5 block">
            Venue Name
          </label>
          <input
            id="venue-name-input"
            value={draftName}
            onChange={e => setDraftName(e.target.value.slice(0, MAX_VENUE_NAME_LEN))}
            placeholder="e.g. The Grand Casino"
            maxLength={MAX_VENUE_NAME_LEN}
            className="w-full bg-raised border border-edge rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-ink-400 font-body focus:outline-none focus:border-gold-500/40 transition-colors"
          />
          <p className="text-[10px] font-mono text-ink-400 mt-1 text-right">
            {draftName.length}/{MAX_VENUE_NAME_LEN}
          </p>
        </div>

        <div>
          <label htmlFor="venue-accent-input" className="text-[10px] font-mono text-ink-400 uppercase tracking-widest mb-1.5 block">
            Accent Color
          </label>
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={validAccent ?? savedAccent}
              onChange={e => setDraftAccent(e.target.value)}
              className="w-10 h-10 rounded-lg border border-edge bg-raised cursor-pointer"
              aria-label="Pick accent color"
            />
            <input
              id="venue-accent-input"
              value={draftAccent}
              onChange={e => setDraftAccent(e.target.value)}
              placeholder="#C9A030"
              maxLength={7}
              className="flex-1 bg-raised border border-edge rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-ink-400 font-mono focus:outline-none focus:border-gold-500/40 transition-colors"
            />
          </div>
          {!validAccent && (
            <p className="text-[10px] font-mono text-red-400 mt-1">Enter a valid hex color, e.g. #C9A030</p>
          )}
        </div>

        {/* Live preview — mirrors the exact markup used on the guest header's
            subtitle line (see app/order/[locationId]/page.tsx) */}
        <div>
          <p className="text-[10px] font-mono text-ink-400 uppercase tracking-widest mb-1.5">
            Guest Page Preview
          </p>
          <div className="bg-base border border-edge rounded-xl px-4 py-4 text-center">
            <p className="font-display text-lg font-semibold" style={{ color: previewAccent }}>Swim Up Pool Side</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Building2 size={11} style={{ color: previewAccent }} />
              <span className="text-xs font-body text-ink-400">{previewName}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || saving || !validAccent}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body font-bold text-sm transition-all disabled:opacity-50",
            isDirty && !saving && validAccent
              ? "bg-gold-gradient text-void shadow-gold-sm hover:brightness-110"
              : "bg-raised border border-edge text-ink-400 cursor-not-allowed",
          )}
        >
          {savedFlash
            ? <><CheckCircle2 size={14} /> Saved</>
            : saving
            ? "Saving…"
            : <><Save size={14} /> Save Venue Branding</>}
        </button>
      </div>
    </div>
  );
}
