"use client";

import { useState, useEffect, useRef } from "react";
import { useJuly4EventSettings, JULY4_SURCHARGE_DELAY_MS } from "@/hooks/useJuly4EventSettings";

const MINUTE_MILESTONES = [50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const TOAST_MS = 3_500;
const FINAL_MS = 6_000;

const FINAL_MESSAGE = "From here on out, orders with an alcoholic beverage will be a $3 charge";

interface ToastDisplay { kind: "toast" | "final"; key: string; label: string }
interface CountdownDisplay { kind: "countdown"; seconds: number }
export type July4MilestoneDisplay = ToastDisplay | CountdownDisplay;

// Drives the full-screen countdown notifications toward the July 4th
// surcharge — minute milestones, then a live second-by-second countdown
// in the final 10 seconds, then a one-time final message. All of it is
// derived purely from the shared event_settings row, so every guest sees
// the same milestones at the same real moments. `suppressed` should be
// true whenever the guest is in an active modal/checkout flow — toasts
// queue (most-recent only) and show the instant it goes false again; the
// live countdown simply isn't rendered while suppressed and resumes
// wherever real time actually is once it's lifted (no replay).
export function useJuly4Milestones(suppressed: boolean, locationId?: string): July4MilestoneDisplay | null {
  const { startedAt, enabled } = useJuly4EventSettings(locationId);
  const firedRef = useRef<Set<string>>(new Set());
  const [pending, setPending] = useState<ToastDisplay | null>(null);
  const [visible, setVisible] = useState<ToastDisplay | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New event (or admin reset/stop) — wipe all milestone state so nothing
  // stale carries over and the next event starts clean.
  useEffect(() => {
    firedRef.current = new Set();
    setPending(null);
    setVisible(null);
    setCountdownSeconds(null);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, [startedAt, enabled]);

  useEffect(() => {
    if (!enabled || !startedAt) return;

    const tick = () => {
      const remainingMs = new Date(startedAt).getTime() + JULY4_SURCHARGE_DELAY_MS - Date.now();

      setCountdownSeconds(remainingMs > 0 && remainingMs <= 10_000 ? Math.ceil(remainingMs / 1000) : null);

      if (remainingMs > 10_000) {
        const minsLeft = Math.ceil(remainingMs / 60_000);
        if (MINUTE_MILESTONES.includes(minsLeft)) {
          const key = `min-${minsLeft}`;
          if (!firedRef.current.has(key)) {
            firedRef.current.add(key);
            setPending({
              kind: "toast",
              key,
              label: `${minsLeft} minute${minsLeft !== 1 ? "s" : ""} remaining in free hour`,
            });
          }
        }
      } else if (remainingMs <= 0 && !firedRef.current.has("final")) {
        firedRef.current.add("final");
        setPending({ kind: "final", key: "final", label: FINAL_MESSAGE });
      }
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [startedAt, enabled]);

  // Promote a queued milestone to visible once nothing's suppressing it
  // and nothing else is currently showing — one at a time, most-recent
  // pending wins since setPending above just overwrites.
  useEffect(() => {
    if (suppressed || visible || !pending) return;
    setVisible(pending);
    setPending(null);
    const dur = pending.kind === "final" ? FINAL_MS : TOAST_MS;
    dismissTimer.current = setTimeout(() => setVisible(null), dur);
  }, [suppressed, pending, visible]);

  if (suppressed) return null;
  if (countdownSeconds !== null) return { kind: "countdown", seconds: countdownSeconds };
  return visible;
}
