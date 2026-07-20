"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Play, Square, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

const SURCHARGE_DELAY_MS = 60 * 60_000;
const POLL_MS            = 3_000;

interface EventState {
  startedAt: string | null;
  enabled:   boolean;
}

export function EventControlCard() {
  const { venueId } = useStore();
  const [state,   setState]   = useState<EventState>({ startedAt: null, enabled: true });
  const [now,     setNow]     = useState(Date.now());
  const [busy,    setBusy]    = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const refresh = useCallback(async () => {
    if (!venueId) return;
    const { data } = await supabase
      .from("event_settings")
      .select("july4_started_at, july4_surcharge_enabled")
      .eq("venue_id", venueId)
      .maybeSingle();
    setState({
      startedAt: data?.july4_started_at ?? null,
      enabled:   data?.july4_surcharge_enabled ?? true,
    });
    setLoaded(true);
  }, [venueId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const startedAtMs = state.startedAt ? new Date(state.startedAt).getTime() : null;
  const activatesAtMs = startedAtMs ? startedAtMs + SURCHARGE_DELAY_MS : null;
  const surchargeActive = state.enabled && startedAtMs !== null && now >= (activatesAtMs ?? Infinity);
  const remainingMs = activatesAtMs ? Math.max(0, activatesAtMs - now) : 0;
  const remainingMin = Math.ceil(remainingMs / 60_000);

  const handleStart = async () => {
    if (!venueId) return;
    setBusy(true);
    const nowIso = new Date().toISOString();
    await supabase
      .from("event_settings")
      .update({ july4_started_at: nowIso, july4_surcharge_enabled: true })
      .eq("venue_id", venueId);
    await refresh();
    setBusy(false);
  };

  const handleStop = async () => {
    if (!venueId) return;
    setBusy(true);
    await supabase
      .from("event_settings")
      .update({ july4_surcharge_enabled: false })
      .eq("venue_id", venueId);
    await refresh();
    setBusy(false);
  };

  const handleReset = async () => {
    if (!venueId) return;
    setBusy(true);
    await supabase
      .from("event_settings")
      .update({ july4_started_at: null, july4_surcharge_enabled: true })
      .eq("venue_id", venueId);
    await refresh();
    setBusy(false);
  };

  const activatesAtLabel = activatesAtMs
    ? new Date(activatesAtMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-gold-400" />
          <h2 className="font-display font-semibold text-white text-base">4th of July Surcharge</h2>
        </div>
        {loaded && (
          <span className={cn(
            "text-[10px] font-mono font-bold rounded-full px-2 py-0.5 border",
            !state.startedAt
              ? "text-ink-500 bg-raised border-edge"
              : !state.enabled
              ? "text-ink-500 bg-raised border-edge"
              : surchargeActive
              ? "text-gold-400 bg-gold-400/10 border-gold-400/20"
              : "text-amber-400 bg-amber-400/10 border-amber-400/20",
          )}>
            {!state.startedAt ? "Not Started" : !state.enabled ? "Disabled" : surchargeActive ? "Active Now" : "Counting Down"}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {!state.startedAt && (
          <>
            <p className="text-ink-400 text-xs font-body leading-relaxed">
              Starts the 1-hour countdown for today's flat $3 surcharge on any order containing alcohol.
              This is a one-time trigger for the event.
            </p>
            <button
              onClick={handleStart}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold-gradient text-void font-body font-bold text-sm shadow-gold-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              <Play size={14} />
              Start Event
            </button>
          </>
        )}

        {state.startedAt && (
          <>
            <div className="flex items-center gap-3 bg-raised/50 border border-edge rounded-xl p-3.5">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                surchargeActive ? "bg-gold-gradient" : "bg-amber-400/15",
              )}>
                {surchargeActive
                  ? <CheckCircle2 size={16} className="text-void" />
                  : <Clock size={16} className="text-amber-400" />}
              </div>
              <div className="min-w-0">
                {surchargeActive ? (
                  <p className="text-white font-body font-semibold text-sm">
                    Surcharge is live — every order with alcohol gets +$3
                  </p>
                ) : state.enabled ? (
                  <p className="text-white font-body font-semibold text-sm">
                    Activates at {activatesAtLabel} · {remainingMin} min remaining
                  </p>
                ) : (
                  <p className="text-white font-body font-semibold text-sm">
                    Surcharge disabled — won't activate
                  </p>
                )}
                <p className="text-ink-500 text-[11px] font-mono mt-0.5">
                  Event started {new Date(state.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {state.enabled ? (
                <button
                  onClick={handleStop}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 font-body font-semibold text-xs hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <Square size={12} />
                  Stop Surcharge
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-felt-500/15 border border-felt-500/25 text-felt-400 font-body font-semibold text-xs hover:bg-felt-500/25 transition-all disabled:opacity-50"
                >
                  <Play size={12} />
                  Re-enable
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={busy}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-raised border border-edge text-ink-400 font-body font-semibold text-xs hover:text-white hover:border-rim transition-all disabled:opacity-50"
              >
                Reset Timer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
