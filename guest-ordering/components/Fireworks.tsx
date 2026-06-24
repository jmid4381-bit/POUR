"use client";

/**
 * Fireworks — brief celebratory burst shown once when the order
 * confirmation screen first appears. Pure CSS (no canvas, no library):
 * each particle is a positioned span animated via a shared keyframe that
 * reads its own trajectory from --dx/--dy custom properties, so one
 * animation definition drives every particle's unique direction/distance.
 *
 * Self-removes after ~2.1s — the parent doesn't need to manage timing.
 */

import { useEffect, useState } from "react";

const COLORS = ["#ef4444", "#f8fafc", "#3b82f6"]; // red, white, blue
const PARTICLES_PER_BURST = 12;

interface Burst {
  id: number;
  xPct: number;
  yPct: number;
  delayMs: number;
}

const BURSTS: Burst[] = [
  { id: 0, xPct: 28, yPct: 30, delayMs: 0   },
  { id: 1, xPct: 72, yPct: 22, delayMs: 220 },
  { id: 2, xPct: 50, yPct: 40, delayMs: 440 },
];

const TOTAL_LIFETIME_MS = 2100;

function Particle({ angle, distance, color, delayMs }: { angle: number; distance: number; color: string; delayMs: number }) {
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  return (
    <span
      className="absolute w-1.5 h-1.5 rounded-full animate-firework-particle"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}`,
        "--dx": `${dx}px`,
        "--dy": `${dy}px`,
        animationDelay: `${delayMs}ms`,
      } as React.CSSProperties}
    />
  );
}

function FireworkBurst({ xPct, yPct, delayMs }: Burst) {
  const particles = Array.from({ length: PARTICLES_PER_BURST }, (_, i) => {
    const angle    = (i / PARTICLES_PER_BURST) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const distance = 70 + Math.random() * 50;
    const color    = COLORS[i % COLORS.length];
    return { angle, distance, color };
  });

  return (
    <div className="absolute" style={{ left: `${xPct}%`, top: `${yPct}%` }}>
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white animate-firework-flash"
        style={{ animationDelay: `${delayMs}ms` }}
      />
      {particles.map((p, i) => (
        <Particle key={i} {...p} delayMs={delayMs} />
      ))}
    </div>
  );
}

export function Fireworks() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), TOTAL_LIFETIME_MS);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none" aria-hidden="true">
      {BURSTS.map(b => <FireworkBurst key={b.id} {...b} />)}
    </div>
  );
}
