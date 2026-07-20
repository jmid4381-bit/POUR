/**
 * lib/ageGate.ts — age verification logic, decoupled from UI and venue.
 *
 * Designed to be reused across venue types (casino, restaurant, airline) —
 * nothing here is casino-specific. Venue name and legal age threshold are
 * configurable, not hardcoded.
 */

import { logError } from "./logger";

export const LEGAL_DRINKING_AGE = 21;
// Multi-tenant fallback — the real venue name (event_settings.venue_name) is
// fetched and passed in by the ordering page; this only matters for a caller
// that doesn't supply one.
export const DEFAULT_VENUE_NAME = "POUR";

const VERIFIED_KEY  = "age_gate_verified";
const DECLINED_KEY  = "age_gate_declined";
const META_KEY      = "age_gate_meta";
const UNDERAGE_KEY  = "is_underage_session";

// "Remember me" — localStorage, not sessionStorage, so it survives a closed
// tab. Deliberately stores only the same minimal bracket+flag already kept
// per-session, NEVER the actual birthdate entered — this is a convenience
// pre-fill for the "Welcome back" prompt, not a stored credential. The real
// security boundary is unchanged: applying it still requires an explicit
// tap in the UI (see applyRememberedVerification), and a fresh birthdate
// entry is always one tap away via "Not me."
const REMEMBER_KEY     = "age_gate_remember";
const REMEMBER_TTL_MS  = 24 * 60 * 60 * 1000; // matches the guest-ID cookie window

export interface RememberedVerification {
  ageBracket: string;
  isUnderage: boolean;
  expiresAt:  number;
}

export interface AgeVerificationMeta {
  ageBracket: string;
  verifiedAt: string;
}

// ─── Session state ────────────────────────────────────────────────────────────

export function hasVerifiedAge(): boolean {
  try { return sessionStorage.getItem(VERIFIED_KEY) === "true"; }
  catch { return false; } // SSR — gate will show on client
}

// Once declined, this session can never retry — matches a real ID check:
// you don't get a second guess after being told no.
export function hasDeclinedAge(): boolean {
  try { return sessionStorage.getItem(DECLINED_KEY) === "true"; }
  catch { return false; }
}

export function getAgeVerificationMeta(): AgeVerificationMeta | null {
  try {
    const raw = sessionStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as AgeVerificationMeta) : null;
  } catch { return null; }
}

// True for the rest of this browser session if the entered birthdate
// calculated to under the legal age — never the actual birthdate, just
// this boolean. Resets on a new session, never follows across devices.
export function isUnderageSession(): boolean {
  try { return sessionStorage.getItem(UNDERAGE_KEY) === "true"; }
  catch { return false; }
}

function markVerified(meta: AgeVerificationMeta): void {
  try {
    sessionStorage.setItem(VERIFIED_KEY, "true");
    sessionStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* storage unavailable — gate will simply re-show */ }
}

// The remembered copy a returning guest's "Welcome back" prompt reads —
// or null if there's none, or it's expired (and cleans up the expired
// entry rather than leaving stale data behind).
export function getRememberedVerification(): RememberedVerification | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const rv = JSON.parse(raw) as RememberedVerification;
    if (!rv.expiresAt || rv.expiresAt < Date.now()) {
      localStorage.removeItem(REMEMBER_KEY);
      return null;
    }
    return rv;
  } catch {
    return null;
  }
}

export function clearRememberedVerification(): void {
  try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
}

// Applies a remembered bracket/flag to THIS session — equivalent to what
// recordVerification() would set, but without re-asking for a birthdate.
// Still only reachable via an explicit "Yes, that's me" tap in the UI.
export function applyRememberedVerification(rv: RememberedVerification, guestId: string): void {
  markVerified({ ageBracket: rv.ageBracket, verifiedAt: new Date().toISOString() });
  markUnderageSession(rv.isUnderage);
  reportAgeVerification(guestId, rv.ageBracket, rv.isUnderage);
}

// Fire-and-forget server-side log of this verification outcome — never the
// birthdate, just the bracket + a SERVER-set timestamp (see
// supabase/age_verification.sql), tied to the guest's cookie id. Two jobs:
// (1) a compliance audit trail independent of whether an order is ever
// placed, and (2) the authoritative source computeOrderCharge checks
// server-side before allowing alcoholic items — closing the gap where only
// a client-side sessionStorage flag decided this. Not awaited by callers;
// a network hiccup here must never block the guest from continuing.
export function reportAgeVerification(guestId: string, bracket: string, isUnderage: boolean): void {
  fetch("/api/age-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guestId, ageBracket: bracket, isUnderage }),
  }).catch(err => {
    logError("Failed to report age verification", err, { guestId });
  });
}

function markUnderageSession(isUnderage: boolean): void {
  try { sessionStorage.setItem(UNDERAGE_KEY, isUnderage ? "true" : "false"); } catch {}
}

// ─── Date-of-birth math ───────────────────────────────────────────────────────

export function isValidBirthdate(year: number, month: number, day: number): boolean {
  if (!year || !month || !day) return false;
  if (month < 1 || month > 12) return false;

  const d = new Date(year, month - 1, day);
  // Round-trip check catches invalid dates like Feb 30
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return false;

  const now = new Date();
  if (d > now) return false;                          // future date
  if (year < now.getFullYear() - 110) return false;    // unrealistic
  return true;
}

export function calculateAge(year: number, month: number, day: number): number {
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}

// Broad bucket, never the exact age or birthdate — minimizes PII retained
// in any downstream record (e.g. attached to an order for later review).
export function ageBracket(age: number, legalAge: number): string {
  if (age < legalAge) return "under_legal_age";
  if (age < 25) return "21-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

// Records the outcome of a verification attempt. Only the bracket and a
// timestamp are persisted — never the actual birthdate entered.
//
// A guest under the legal age is no longer hard-blocked from the app —
// they're let in, but flagged as an underage session so the ordering page
// can restrict the menu to non-alcoholic items only.
export function recordVerification(
  age: number,
  legalAge: number,
  guestId: string,
): { isUnderage: boolean; meta: AgeVerificationMeta } {
  const bracket     = ageBracket(age, legalAge);
  const isUnderage  = age < legalAge;
  const meta: AgeVerificationMeta = { ageBracket: bracket, verifiedAt: new Date().toISOString() };

  markVerified(meta);
  markUnderageSession(isUnderage);
  reportAgeVerification(guestId, bracket, isUnderage);

  // Mirror into the longer-lived "remember me" slot too, so a returning
  // guest gets the "Welcome back" prompt instead of retyping their
  // birthdate — still only the bracket/flag, never the actual birthdate.
  try {
    const rv: RememberedVerification = { ageBracket: bracket, isUnderage, expiresAt: Date.now() + REMEMBER_TTL_MS };
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(rv));
  } catch { /* storage unavailable — next visit just starts fresh */ }

  return { isUnderage, meta };
}
