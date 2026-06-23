"use client";

import { useState, useEffect } from "react";
import { readGuestCooldownExpiry } from "@/lib/guestCooldown";

/**
 * Fetches each unique guest's cooldown expiry on a moderate interval — NOT
 * a per-card timer. The live countdown itself is driven by the shared
 * ClockContext tick wherever this map is consumed; this hook only refreshes
 * the underlying expiry timestamps periodically.
 */
export function useGuestCooldowns(guestIds: string[]): Map<string, number> {
  const [expiries, setExpiries] = useState<Map<string, number>>(new Map());
  const idsKey = [...new Set(guestIds)].sort().join(",");

  useEffect(() => {
    const unique = idsKey ? idsKey.split(",") : [];
    if (unique.length === 0) {
      setExpiries(new Map());
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const results = await Promise.all(
        unique.map(async id => [id, await readGuestCooldownExpiry(id)] as const)
      );
      if (cancelled) return;
      setExpiries(() => {
        const next = new Map<string, number>();
        for (const [id, expiry] of results) {
          if (expiry) next.set(id, expiry);
        }
        return next;
      });
    };

    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [idsKey]);

  return expiries;
}
