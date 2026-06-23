"use client";

/**
 * useAudio — Web Audio API notification chimes.
 *
 * No external files required. All tones generated programmatically.
 * Handles the browser autoplay restriction: audio is silently buffered
 * until the user first interacts with the page, then plays normally.
 */

import { useRef, useCallback, useEffect, useState } from "react";

type ChimeType = "new-order" | "overdue" | "delivered";

// Musical note frequencies
const NOTES = {
  C5: 523.25, E5: 659.25, G5: 783.99,  // pleasant new-order chord
  A4: 440.00, C5b: 466.16,             // urgent double-beep
  G4: 392.00, C5c: 523.25, E5b: 659.25, // delivered rising tone
};

const CHIMES: Record<ChimeType, Array<{ freq: number; start: number; duration: number; gain: number }>> = {
  "new-order": [
    { freq: NOTES.C5, start: 0.00, duration: 0.18, gain: 0.28 },
    { freq: NOTES.E5, start: 0.12, duration: 0.18, gain: 0.28 },
    { freq: NOTES.G5, start: 0.24, duration: 0.30, gain: 0.28 },
  ],
  "overdue": [
    { freq: NOTES.A4,  start: 0.00, duration: 0.14, gain: 0.35 },
    { freq: NOTES.A4,  start: 0.20, duration: 0.14, gain: 0.35 },
    { freq: NOTES.C5b, start: 0.40, duration: 0.22, gain: 0.35 },
  ],
  "delivered": [
    { freq: NOTES.G4,   start: 0.00, duration: 0.14, gain: 0.22 },
    { freq: NOTES.C5c,  start: 0.10, duration: 0.14, gain: 0.22 },
    { freq: NOTES.E5b,  start: 0.20, duration: 0.22, gain: 0.22 },
  ],
};

export function useAudio() {
  const ctxRef          = useRef<AudioContext | null>(null);
  const [enabled, setEnabled]   = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  // Unlock audio on first user interaction (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      if (unlocked) return;
      try {
        if (!ctxRef.current) {
          ctxRef.current = new AudioContext();
        }
        if (ctxRef.current.state === "suspended") {
          ctxRef.current.resume();
        }
        setUnlocked(true);
      } catch { /* ignore */ }
    };
    window.addEventListener("click",      unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    window.addEventListener("keydown",    unlock, { once: true });
    return () => {
      window.removeEventListener("click",      unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown",    unlock);
    };
  }, [unlocked]);

  const play = useCallback((type: ChimeType) => {
    if (!enabled) return;
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
        return; // will play on next trigger once unlocked
      }

      const notes = CHIMES[type];
      const now   = ctx.currentTime;

      notes.forEach(({ freq, start, duration, gain }) => {
        const osc  = ctx.createOscillator();
        const gNode= ctx.createGain();

        osc.connect(gNode);
        gNode.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);

        // Smooth fade-in + fade-out to avoid clicks
        gNode.gain.setValueAtTime(0, now + start);
        gNode.gain.linearRampToValueAtTime(gain, now + start + 0.03);
        gNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.start(now + start);
        osc.stop(now + start + duration + 0.05);
      });
    } catch { /* AudioContext not supported or blocked */ }
  }, [enabled]);

  const toggle = useCallback(() => setEnabled(e => !e), []);

  return { play, enabled, toggle, unlocked };
}
