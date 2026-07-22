"use client";

/**
 * AudioSettingsMenu — per-chime mute control.
 *
 * A single "mute everything" toggle can't express the real want on a loud
 * floor: keep the new-order/overdue alarms live, but silence the
 * lower-priority "delivered" ding. This exposes each chime independently
 * instead of one master switch.
 */

import { useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChimeType = "new-order" | "overdue" | "delivered";

const ROWS: { type: ChimeType; label: string }[] = [
  { type: "new-order", label: "New order" },
  { type: "overdue",   label: "Overdue alarm" },
  { type: "delivered", label: "Delivered" },
];

interface AudioSettingsMenuProps {
  enabled:    Record<ChimeType, boolean>;
  anyEnabled: boolean;
  isOpen:     boolean;
  onOpen:     () => void;
  onClose:    () => void;
  onToggle:   (type: ChimeType) => void;
}

export function AudioSettingsMenu({ enabled, anyEnabled, isOpen, onOpen, onClose, onToggle }: AudioSettingsMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={isOpen ? onClose : onOpen}
        title="Notification sounds"
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
          anyEnabled
            ? "bg-surface border-border text-slate-400 hover:text-white"
            : "bg-slate-500/10 border-slate-500/20 text-slate-400",
        )}
      >
        {anyEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 w-52 bg-surface border border-border rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden z-50 animate-slide-down p-2 space-y-1">
          {ROWS.map(row => (
            <button
              key={row.type}
              onClick={() => onToggle(row.type)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-raised transition-colors"
            >
              <span className="text-xs font-body text-slate-200">{row.label}</span>
              <span className={cn(
                "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                enabled[row.type]
                  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                  : "text-slate-400 bg-raised border-border",
              )}>
                {enabled[row.type] ? "On" : "Off"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
