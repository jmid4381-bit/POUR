"use client";

/**
 * lib/guestSession.ts — persistent per-guest identifier.
 *
 * A UUID issued on first visit and stored in a cookie (not sessionStorage
 * or localStorage) so it:
 *  - Survives a page refresh
 *  - Survives closing and reopening the browser tab/window
 *  - Can be read server-side later if needed (e.g. in an API route or
 *    middleware), since cookies — unlike localStorage/sessionStorage — are
 *    sent with every HTTP request automatically
 *
 * Expires after 24 hours. Does NOT identify a location/table — that's a
 * separate concept (locationId) — this identifies the same physical guest
 * across however many tables/orders they visit within that window.
 */

const GUEST_ID_COOKIE = "pour_guest_id";
const MAX_AGE_SECONDS  = 24 * 60 * 60; // 24 hours

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

// Returns the existing guest ID, or mints and stores a new one. Safe to
// call on every render — it's a no-op once the cookie already exists.
export function getOrCreateGuestId(): string {
  const existing = readCookie(GUEST_ID_COOKIE);
  if (existing) return existing;

  const id = crypto.randomUUID();
  writeCookie(GUEST_ID_COOKIE, id, MAX_AGE_SECONDS);
  return id;
}

// Mints a brand-new ID and overwrites the cookie unconditionally — used
// when a guest explicitly says "Not me" on a shared device, so the next
// person doesn't inherit the previous guest's restored order history
// (purely informational state; this never touches the cooldown's own
// enforcement, which already passes through this same cookie value).
export function resetGuestId(): string {
  const id = crypto.randomUUID();
  writeCookie(GUEST_ID_COOKIE, id, MAX_AGE_SECONDS);
  return id;
}
