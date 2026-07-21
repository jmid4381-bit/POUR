import type { Session } from "@supabase/supabase-js";

// A regular staff/admin account is bound to exactly one venue via
// app_metadata.venue_id (set manually in the Supabase dashboard — see
// guest-ordering/supabase/multi_tenancy_phase1a_schema.sql). platform_admin
// accounts (Justin) have no fixed venue_id and instead pick one via the
// venue switcher in the header — see useCurrentVenue below.

export function getSessionVenueId(session: Session | null): string | null {
  return (session?.user.app_metadata?.venue_id as string | undefined) ?? null;
}

export function isPlatformAdmin(session: Session | null): boolean {
  return session?.user.app_metadata?.role === "platform_admin";
}

export function getSessionDisplayName(session: Session | null): string | null {
  const raw = session?.user.app_metadata?.display_name;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

const SWITCHER_STORAGE_KEY = "pour_platform_admin_venue_id";

export function getStoredSwitcherVenueId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SWITCHER_STORAGE_KEY);
}

export function setStoredSwitcherVenueId(venueId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SWITCHER_STORAGE_KEY, venueId);
}

// Last-known venue branding, cached so a fresh page load can paint the
// CORRECT venue name/color on the very first render instead of the
// hardcoded "POUR" default while the real value is still being resolved
// (session load -> venueId -> Supabase fetch, all async). Read via a
// useState lazy initializer (synchronous on first render) rather than an
// effect, which is what actually eliminates the flash.
export interface CachedVenueBranding {
  venueId:     string;
  name:        string;
  accentColor: string;
}

const BRANDING_CACHE_KEY = "pour_last_venue_branding";

export function getCachedVenueBranding(): CachedVenueBranding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedVenueBranding) : null;
  } catch {
    return null;
  }
}

export function setCachedVenueBranding(branding: CachedVenueBranding): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
}
