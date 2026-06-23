"use client";

/**
 * lib/guestName.ts — the name a guest chose to be called, for this session.
 *
 * Stored separately from age verification — this is identity the guest
 * chose to share, not PII collected automatically. Scoped to sessionStorage
 * (not the persistent guest-ID cookie) since it's tied to this ordering
 * session's experience, not used for any enforcement or tracking.
 */

const GUEST_NAME_KEY = "guest_display_name";
const MAX_LEN         = 30;
const DEFAULT_NAME    = "Guest";

export function getGuestName(): string {
  try {
    const raw = sessionStorage.getItem(GUEST_NAME_KEY);
    return raw && raw.trim() ? raw : DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

// Trims whitespace and caps length — blank input becomes the neutral
// default rather than ever storing an empty/null name.
export function setGuestName(name: string): void {
  try {
    const trimmed = name.trim().slice(0, MAX_LEN);
    sessionStorage.setItem(GUEST_NAME_KEY, trimmed || DEFAULT_NAME);
  } catch { /* storage unavailable — order submission will fall back to default */ }
}
