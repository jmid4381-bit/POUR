"use client";

/**
 * VenueSettingsCard — multi-tenant branding control.
 *
 * Lets an admin set the venue name shown to guests (ordering page) and staff
 * (dashboard header) for this deployment, without any code change or redeploy.
 * Backed by `event_settings.venue_name` — the same row/table already polled
 * elsewhere in the app, so this adds no new infrastructure.
 */

import { useState, useEffect, useCallback } from "react";
import { Building2, Save, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const MAX_VENUE_NAME_LEN = 50;
export const DEFAULT_VENUE_NAME = "POUR";
const POLL_MS = 8_000;

export function VenueSettingsCard() {
  const [savedName,  setSavedName]  = useState<string>(DEFAULT_VENUE_NAME);
  const [draft,      setDraft]      = useState<string>("");
  const [loaded,     setLoaded]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("event_settings")
      .select("venue_name")
      .eq("id", 1)
      .maybeSingle();
    const name = (data?.venue_name ?? "").trim() || DEFAULT_VENUE_NAME;
    setSavedName(name);
    // Only seed the editable field on first load — later polls shouldn't
    // clobber whatever the admin is actively typing.
    setLoaded(prev => {
      if (!prev) setDraft(name);
      return true;
    });
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const trimmedDraft = draft.trim();
  const isDirty = loaded && trimmedDraft !== savedName;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const clean = trimmedDraft.slice(0, MAX_VENUE_NAME_LEN);
    await supabase
      .from("event_settings")
      .update({ venue_name: clean || null }) // empty → null → guest/staff apps fall back to "POUR"
      .eq("id", 1);
    await refresh();
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  const previewName = trimmedDraft || DEFAULT_VENUE_NAME;

  return (
    <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-gold-400" />
          <h2 className="font-display font-semibold text-white text-base">Venue Branding</h2>
        </div>
        {loaded && (
          <span className="text-[10px] font-mono font-bold rounded-full px-2 py-0.5 border text-ink-500 bg-raised border-edge">
            Live: {savedName}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-ink-400 text-xs font-body leading-relaxed">
          Shown to guests on the ordering page and to staff on their dashboard. Changes apply within
          seconds across every device — no redeploy needed. Leave blank to use the default, &quot;{DEFAULT_VENUE_NAME}&quot;.
        </p>

        <div>
          <label htmlFor="venue-name-input" className="text-[10px] font-mono text-ink-500 uppercase tracking-widest mb-1.5 block">
            Venue Name
          </label>
          <input
            id="venue-name-input"
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, MAX_VENUE_NAME_LEN))}
            placeholder="e.g. The Grand Casino"
            maxLength={MAX_VENUE_NAME_LEN}
            className="w-full bg-raised border border-edge rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-ink-600 font-body focus:outline-none focus:border-gold-500/40 transition-colors"
          />
          <p className="text-[10px] font-mono text-ink-600 mt-1 text-right">
            {draft.length}/{MAX_VENUE_NAME_LEN}
          </p>
        </div>

        {/* Live preview — mirrors the exact markup used on the guest header's
            subtitle line (see app/order/[locationId]/page.tsx) */}
        <div>
          <p className="text-[10px] font-mono text-ink-500 uppercase tracking-widest mb-1.5">
            Guest Page Preview
          </p>
          <div className="bg-base border border-edge rounded-xl px-4 py-4 text-center">
            <p className="font-display text-lg font-semibold text-white leading-tight">Swim Up Pool Side</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Building2 size={11} className="text-felt-500" />
              <span className="text-xs font-body text-ink-400">{previewName}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body font-bold text-sm transition-all disabled:opacity-50",
            isDirty && !saving
              ? "bg-gold-gradient text-void shadow-gold-sm hover:brightness-110"
              : "bg-raised border border-edge text-ink-600 cursor-not-allowed",
          )}
        >
          {savedFlash
            ? <><CheckCircle2 size={14} /> Saved</>
            : saving
            ? "Saving…"
            : <><Save size={14} /> Save Venue Name</>}
        </button>
      </div>
    </div>
  );
}
