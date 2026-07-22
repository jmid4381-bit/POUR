"use client";

/**
 * ZonePicker — staff-side sheet for requesting a zone switch/add.
 * Designed to be fast: one tap per zone per action, no multi-step form.
 * Shows live active-order counts per zone so staff can see at a glance
 * where help is actually needed.
 */

import { X, MapPin, ArrowLeftRight, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffLocation } from "@/lib/locations";
import type { MyZoneRequest, ZoneRequestType } from "@/hooks/useZoneRequests";

function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

interface ZonePickerProps {
  locations:        StaffLocation[];
  myZoneIds:        Set<string>;
  orderCountByZone: Map<string, number>;
  pending:          MyZoneRequest | null;
  submitting:       boolean;
  onSubmit:         (type: ZoneRequestType, zoneId: string) => void;
  onClose:          () => void;
}

export function ZonePicker({
  locations, myZoneIds, orderCountByZone, pending, submitting, onSubmit, onClose,
}: ZonePickerProps) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request a zone change"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-base border-t border-border rounded-t-3xl shadow-card animate-fade-up max-h-[80dvh]"
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-rim" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-display font-semibold text-white text-lg leading-none">Zones</h2>
            <p className="text-slate-400 text-[11px] font-mono mt-0.5">Request to switch or add a zone</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {pending && pending.status === "pending" && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-400/8 border-b border-amber-400/15 flex-shrink-0">
            <Clock size={12} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs font-body">
              Waiting on admin approval — sent {minutesAgo(pending.createdAt)}m ago.
              {" "}Mis-tapped? Request a different zone below to replace it.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-2.5">
          {locations.map(loc => {
            const isMine = myZoneIds.has(loc.id);
            const count  = orderCountByZone.get(loc.id) ?? 0;
            // Submitting again while a request is already pending is
            // allowed (not blocked) — it's the fastest way to correct a
            // mis-tap without waiting for the first request to resolve.
            const disabled = submitting;

            return (
              <div
                key={loc.id}
                className={cn(
                  "rounded-xl border px-3.5 py-3 flex items-center gap-3",
                  isMine ? "border-gold-500/25 bg-gold-500/5" : "border-border bg-surface",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className={isMine ? "text-gold-400" : "text-slate-400"} />
                    <p className="text-white font-body font-medium text-sm truncate">{loc.name}</p>
                    {isMine && (
                      <span className="text-[9px] font-mono text-gold-400 uppercase tracking-wide flex-shrink-0">Yours</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[10px] font-mono mt-0.5">{loc.section} · Floor {loc.floor}</p>
                </div>

                <span className={cn(
                  "font-mono font-bold text-sm px-2 py-1 rounded-lg flex-shrink-0",
                  count >= 4 ? "text-red-400 bg-red-400/10" : count > 0 ? "text-amber-400 bg-amber-400/10" : "text-slate-400 bg-raised",
                )}>
                  {count}
                </span>

                {!isMine && (
                  // Text labels, not icon-only — "Add" (keep your current
                  // zone(s), plus this one) and "Switch" (drop everything
                  // else, reassign fully to this one) have very different
                  // consequences and looked too similar at a glance before.
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onSubmit("add", loc.id)}
                      disabled={disabled}
                      aria-label={`Add ${loc.name} as an additional zone`}
                      title="Add this zone alongside your current one(s)"
                      className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-blue-400/10 border border-blue-400/20 text-blue-400 hover:bg-blue-400/20 transition-all disabled:opacity-40 text-[11px] font-mono font-bold"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                    <button
                      onClick={() => onSubmit("switch", loc.id)}
                      disabled={disabled}
                      aria-label={`Switch fully to ${loc.name}, dropping your other zones`}
                      title="Switch fully to this zone — drops your other zone(s)"
                      className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-felt-500/15 border border-felt-500/25 text-felt-400 hover:bg-felt-500/25 transition-all disabled:opacity-40 text-[11px] font-mono font-bold"
                    >
                      <ArrowLeftRight size={12} />
                      Switch
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
