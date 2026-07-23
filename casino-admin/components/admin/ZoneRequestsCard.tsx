"use client";

import { useState } from "react";
import { MapPin, Check, X, ArrowRight, Users, UserMinus } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ZoneRequest } from "@/lib/types";

const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready"];

export function ZoneRequestsCard() {
  const { state, approveZoneRequest, denyZoneRequest, removeStaffZone } = useStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeLocations = state.locations.filter(l => l.isActive);

  const orderCountByZone = new Map<string, number>();
  for (const o of state.orders) {
    if (!o.locationId || !ACTIVE_STATUSES.includes(o.status)) continue;
    orderCountByZone.set(o.locationId, (orderCountByZone.get(o.locationId) ?? 0) + 1);
  }

  const zoneName = (id: string) => state.locations.find(l => l.id === id)?.name ?? id;
  const zonesForStaff = (staffName: string) =>
    state.staffZones.filter(z => z.staffName === staffName).map(z => zoneName(z.locationId));

  const pending = state.zoneRequests
    .filter(r => r.status === "pending")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Group current assignments by staff member, for the "done helping" remove control
  const staffNames = [...new Set(state.staffZones.map(z => z.staffName))].sort();

  const handleApprove = async (req: ZoneRequest) => {
    setBusyId(req.id);
    await approveZoneRequest(req);
    setBusyId(null);
  };
  const handleDeny = async (id: string) => {
    setBusyId(id);
    await denyZoneRequest(id);
    setBusyId(null);
  };
  const handleRemove = async (staffName: string, locationId: string) => {
    const key = `${staffName}:${locationId}`;
    setBusyId(key);
    await removeStaffZone(staffName, locationId);
    setBusyId(null);
  };

  return (
    <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-gold-400" />
          <h2 className="font-display font-semibold text-white text-base">Zone Requests</h2>
        </div>
        {pending.length > 0 && (
          <span className="text-2xs font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Live zone pressure — active order count per zone, at a glance */}
      <div className="px-5 py-3.5 border-b border-edge flex flex-wrap gap-2">
        {activeLocations.map(loc => {
          const count = orderCountByZone.get(loc.id) ?? 0;
          return (
            <span
              key={loc.id}
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border",
                count >= 4 ? "text-red-400 bg-red-400/10 border-red-400/20"
                  : count > 0 ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                  : "text-ink-400 bg-raised border-edge",
              )}
            >
              <MapPin size={10} />
              {loc.name}
              <span className="font-bold">{count}</span>
            </span>
          );
        })}
      </div>

      {/* Pending requests */}
      <div className="p-5">
        {pending.length === 0 ? (
          <p className="text-ink-400 text-xs font-body text-center py-2">No pending zone requests</p>
        ) : (
          <div className="space-y-2.5">
            {pending.map(req => {
              const currentZones = zonesForStaff(req.staffName);
              const isBusy = busyId === req.id;
              return (
                <div key={req.id} className="flex items-center justify-between gap-3 bg-raised/50 border border-edge rounded-xl px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-white font-body font-semibold text-sm leading-tight">{req.staffName}</p>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-400 mt-0.5 flex-wrap">
                      <span className="truncate">{currentZones.length > 0 ? currentZones.join(", ") : "No zone"}</span>
                      <ArrowRight size={10} className="text-ink-400 flex-shrink-0" />
                      <span className="text-gold-300">{zoneName(req.requestedZoneId)}</span>
                      <span className="text-ink-400">·</span>
                      <span className="uppercase tracking-wide text-ink-400">{req.requestType}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDeny(req.id)}
                      disabled={isBusy}
                      aria-label="Deny request"
                      className="w-11 h-11 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isBusy}
                      aria-label="Approve request"
                      className="w-11 h-11 rounded-lg bg-felt-500/15 border border-felt-500/25 text-felt-400 hover:bg-felt-500/25 flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current assignments — pull a staff member off a zone once they're
          done helping, no request/approval needed for this direction */}
      <div className="px-5 pb-5 pt-1 border-t border-edge">
        <p className="text-2xs font-mono text-ink-400 uppercase tracking-widest mb-3">Current Assignments</p>
        {staffNames.length === 0 ? (
          <p className="text-ink-400 text-xs font-body">No zones assigned</p>
        ) : (
          <div className="space-y-2">
            {staffNames.map(staffName => (
              <div key={staffName} className="flex items-start gap-2.5">
                <span className="text-white font-body font-medium text-sm flex-shrink-0 pt-0.5">{staffName}</span>
                <div className="flex flex-wrap gap-1.5">
                  {state.staffZones.filter(z => z.staffName === staffName).map(z => {
                    const key = `${staffName}:${z.locationId}`;
                    return (
                      <span
                        key={z.locationId}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-300 bg-raised border border-edge rounded-full pl-2.5 pr-1 py-1"
                      >
                        {zoneName(z.locationId)}
                        <button
                          onClick={() => handleRemove(staffName, z.locationId)}
                          disabled={busyId === key}
                          aria-label={`Remove ${staffName} from ${zoneName(z.locationId)}`}
                          title="Remove from this zone"
                          className="w-8 h-8 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 flex items-center justify-center transition-all disabled:opacity-50 flex-shrink-0"
                        >
                          <UserMinus size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
