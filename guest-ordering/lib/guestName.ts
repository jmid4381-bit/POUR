"use client";

/**
 * lib/guestName.ts — the name a guest chose to be called, for this session.
 *
 * Stored separately from age verification — this is identity the guest
 * chose to share, not PII collected automatically. Scoped to sessionStorage
 * (not the persistent guest-ID cookie) since it's tied to this ordering
 * session's experience, not used for any enforcement or tracking.
 */

const GUEST_NAME_KEY     = "guest_display_name";
const REMEMBERED_NAME_KEY= "guest_display_name_remembered";
const MAX_LEN             = 30;
const DEFAULT_NAME        = "Guest";

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
//
// Also mirrors a real (non-default) name into localStorage so it survives
// a closed tab, purely for the "Welcome back" convenience prompt in
// AgeGate — this is never read for enforcement, only to pre-fill a name
// the guest still has to explicitly reconfirm.
export function setGuestName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_LEN);
  try {
    sessionStorage.setItem(GUEST_NAME_KEY, trimmed || DEFAULT_NAME);
  } catch { /* storage unavailable — order submission will fall back to default */ }
  try {
    if (trimmed) localStorage.setItem(REMEMBERED_NAME_KEY, trimmed);
  } catch { /* storage unavailable — welcome-back prompt just won't show */ }
}

// The name remembered from a previous visit (any tab, same device/browser),
// or null if none was saved — distinct from getGuestName(), which only
// reads this tab's session and falls back to "Guest".
export function getRememberedGuestName(): string | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_NAME_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function clearRememberedGuestName(): void {
  try { localStorage.removeItem(REMEMBERED_NAME_KEY); } catch { /* ignore */ }
}
