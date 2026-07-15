"use client";

/**
 * useMenu — reads beverages and locations from Supabase.
 *
 * Priority:
 *  1. Supabase (live data — price and availability changes appear instantly)
 *  2. Static data in lib/data.ts (fallback if Supabase is unreachable)
 *
 * Admin-managed fields (from Supabase):
 *   price · isAvailable · isFeatured · isAlcoholic · prepMinutes
 *
 * Static-only fields (rich content not in the Supabase schema):
 *   tagline · description · ingredients · isSignature · isVip · pairsWith
 *
 * Re-fetches on:
 *   - Initial mount
 *   - Window focus (manager changes availability in admin → guests see it)
 *   - Visibility change (phone unlocked, tab returned to)
 *   - Supabase Realtime change on the beverages table (instant push)
 *   - A short polling interval — the reliable fallback that guarantees the
 *     menu still updates within a few seconds even if Realtime delivers no
 *     events (Realtime has historically been unreliable on this project, so
 *     the poll is what actually makes availability changes propagate).
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { BEVERAGES, LOCATIONS, type Beverage, type Location } from "@/lib/data";
import { readAdminBeverages, readAdminLocations } from "@/lib/queue";
import { logMessage } from "@/lib/logger";

// How often the fallback poll re-fetches the menu while a guest is actively
// viewing it. Kept modest to limit round-trips for a small event; Realtime
// (when it works) makes changes appear faster than this anyway.
const MENU_POLL_MS = 8_000;

// Merge Supabase data over the static fallback.
// Static data provides the rich content; Supabase controls operational fields.
//
// Iterates over Supabase (the source of truth for which beverages exist) and
// enriches with static content where available — NOT the other way around.
// A beverage added directly in Supabase/admin without a matching static
// entry still appears (using its live fields, with empty rich-content
// fields) instead of silently vanishing from the menu.
async function mergedBeverages(): Promise<Beverage[]> {
  const liveData = await readAdminBeverages();
  if (!liveData || liveData.length === 0) return BEVERAGES;

  const staticById = new Map(BEVERAGES.map(b => [b.id, b]));

  return liveData.map(liveBev => {
    const staticBev = staticById.get(liveBev.id);
    if (staticBev) {
      return {
        ...staticBev,
        price:       liveBev.price,
        isAvailable: liveBev.isAvailable,
        isFeatured:  liveBev.isFeatured,
        isAlcoholic: liveBev.isAlcoholic,
        prepMinutes: liveBev.prepMinutes,
        // Supabase is the source of truth once the admin has set these —
        // fall back to the static seed content only if Supabase has none.
        emoji:       liveBev.emoji || staticBev.emoji,
        description: liveBev.description || staticBev.description,
        imageUrl:    liveBev.imageUrl ?? staticBev.imageUrl ?? null,
        giantAvailable: liveBev.giantAvailable,
      };
    }
    // No static content yet — show with what Supabase has, gracefully
    return {
      id:           liveBev.id,
      name:         liveBev.name,
      tagline:      liveBev.tagline,
      description:  liveBev.description,
      ingredients:  [],
      category:     liveBev.category as Beverage["category"],
      emoji:        liveBev.emoji || "🍸",
      imageUrl:     liveBev.imageUrl ?? null,
      price:        liveBev.price,
      isAlcoholic:  liveBev.isAlcoholic,
      isAvailable:  liveBev.isAvailable,
      isFeatured:   liveBev.isFeatured,
      isSignature:  false,
      isVip:        false,
      giantAvailable: liveBev.giantAvailable,
      prepMinutes:  liveBev.prepMinutes,
      tags:         [],
    };
  });
}

async function mergedLocations(): Promise<Location[]> {
  const liveLocs = await readAdminLocations();
  if (!liveLocs || liveLocs.length === 0) return LOCATIONS;

  return liveLocs.map(l => ({
    id:       l.id,
    name:     l.name,
    section:  l.section,
    floor:    l.floor,
    isActive: l.isActive,
  }));
}

// Module-level cache — persists across remounts within the same tab (e.g.
// navigating away and back) so a quick re-render doesn't trigger a fresh
// Supabase round-trip every time. Window focus always forces a fresh fetch
// regardless of TTL, so an admin price/availability change still shows up
// promptly when a guest returns to the tab.
let cachedBeverages: Beverage[] | null = null;
let cachedLocations: Location[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export function useMenu() {
  const [beverages,  setBeverages]  = useState<Beverage[]>(cachedBeverages ?? BEVERAGES);
  const [locations,  setLocations]  = useState<Location[]>(cachedLocations ?? LOCATIONS);
  const [loading,    setLoading]    = useState(!cachedBeverages);
  const [lastSynced, setLastSynced] = useState<Date | null>(cachedAt ? new Date(cachedAt) : null);

  const refresh = useCallback(async (force = false) => {
    const fresh = Date.now() - cachedAt < CACHE_TTL_MS;
    if (!force && fresh && cachedBeverages && cachedLocations) {
      setBeverages(cachedBeverages);
      setLocations(cachedLocations);
      setLastSynced(new Date(cachedAt));
      setLoading(false);
      return;
    }

    try {
      const [bevs, locs] = await Promise.all([
        mergedBeverages(),
        mergedLocations(),
      ]);
      cachedBeverages = bevs;
      cachedLocations = locs;
      cachedAt = Date.now();
      setBeverages(bevs);
      setLocations(locs);
      setLastSynced(new Date(cachedAt));
    } catch {
      // Static fallback already set as initial state — nothing to do
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch — serves from cache if still fresh
  useEffect(() => { refresh(); }, [refresh]);

  // Re-sync when tab regains focus — always forces a fresh fetch
  useEffect(() => {
    const forceRefresh = () => refresh(true);
    window.addEventListener("focus",              forceRefresh);
    document.addEventListener("visibilitychange", forceRefresh);
    return () => {
      window.removeEventListener("focus",              forceRefresh);
      document.removeEventListener("visibilitychange", forceRefresh);
    };
  }, [refresh]);

  // ── Supabase Realtime — instant push when an admin changes a beverage ──
  // Listens for ANY change to the beverages table (availability toggle, price
  // edit, insert, delete) and re-fetches the merged menu. A short debounce
  // coalesces a burst of row updates (e.g. admin toggling several drinks) into
  // a single re-fetch. The client auto-reconnects after a network blip, so no
  // error is ever surfaced to the guest; the polling fallback below covers any
  // gap while a reconnect is in flight.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => refresh(true), 300);
    };

    const channel = supabase
      .channel("beverages-menu-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beverages" },
        scheduleRefresh,
      )
      .subscribe((status) => {
        // CLOSED is expected on unmount/cleanup — not logged. CHANNEL_ERROR/
        // TIMED_OUT are real drops the polling fallback quietly masks; log
        // them so a Realtime outage is visible instead of silent again.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logMessage("Realtime subscription failed: beverages-menu-changes", { status });
        }
      });

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // ── Polling fallback — the guarantee ──
  // Realtime is best-effort on this project; this interval is what actually
  // ensures an availability change reaches every active guest within a few
  // seconds even when no Realtime event arrives. force=true bypasses the TTL
  // cache; refresh() never toggles the loading spinner on a re-fetch, so this
  // causes no flicker — an unavailable drink simply isn't in the next render.
  useEffect(() => {
    const id = setInterval(() => refresh(true), MENU_POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { beverages, locations, loading, lastSynced, refresh };
}
