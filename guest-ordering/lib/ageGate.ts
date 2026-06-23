/**
 * lib/ageGate.ts — age verification logic, decoupled from UI and venue.
 *
 * Designed to be reused across venue types (casino, restaurant, airline) —
 * nothing here is casino-specific. Venue name and legal age threshold are
 * configurable, not hardcoded.
 */

export const LEGAL_DRINKING_AGE = 21;
export const DEFAULT_VENUE_NAME = "The Grand Casino";

const VERIFIED_KEY  = "age_gate_verified";
const DECLINED_KEY  = "age_gate_declined";
const META_KEY      = "age_gate_meta";
const UNDERAGE_KEY  = "is_underage_session";

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
): { isUnderage: boolean; meta: AgeVerificationMeta } {
  const bracket     = ageBracket(age, legalAge);
  const isUnderage  = age < legalAge;
  const meta: AgeVerificationMeta = { ageBracket: bracket, verifiedAt: new Date().toISOString() };

  markVerified(meta);
  markUnderageSession(isUnderage);

  return { isUnderage, meta };
}
