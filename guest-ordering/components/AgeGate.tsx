"use client";

/**
 * AgeGate — date-of-birth verification (not a single self-attestation tap),
 * followed by a lightweight "what should we call you?" step.
 *
 * Generic across venue types — casino, restaurant, airline — via the
 * `venueName` and `legalAge` props. No venue-specific copy lives in the
 * verification logic itself (see lib/ageGate.ts).
 *
 * Shown once per browser session. A birthdate under the legal age does not
 * block the guest — it flags the session as underage so the ordering page
 * can restrict the menu to non-alcoholic items only. Both groups still
 * move on to the name step, since both should be addressed by name.
 */

import { useRef, useState } from "react";
import { ShieldCheck, XCircle, UserRound, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  LEGAL_DRINKING_AGE, DEFAULT_VENUE_NAME,
  isValidBirthdate, calculateAge, recordVerification,
  getRememberedVerification, clearRememberedVerification, applyRememberedVerification,
  type RememberedVerification,
} from "@/lib/ageGate";
import { setGuestName, getRememberedGuestName, clearRememberedGuestName } from "@/lib/guestName";

export { hasVerifiedAge, hasDeclinedAge, getAgeVerificationMeta, isUnderageSession } from "@/lib/ageGate";
export { getGuestName } from "@/lib/guestName";

const NAME_MAX_LEN = 30;

interface AgeGateProps {
  onConfirm:  () => void;
  onDecline:  () => void;
  legalAge?:  number;
  venueName?: string;
}

export function AgeGate({
  onConfirm, onDecline,
  legalAge = LEGAL_DRINKING_AGE,
  venueName = DEFAULT_VENUE_NAME,
}: AgeGateProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  // A returning guest (same device, within the remembered window) sees a
  // "Welcome back" reconfirmation instead of retyping their birthdate —
  // computed once via lazy init, which safely returns null under SSR.
  const [remembered] = useState<RememberedVerification | null>(() => getRememberedVerification());
  const [rememberedName] = useState<string | null>(() => getRememberedGuestName());

  const [step,  setStep]  = useState<"welcome-back" | "birthdate" | "name">(
    () => (getRememberedVerification() && getRememberedGuestName()) ? "welcome-back" : "birthdate",
  );
  const [month, setMonth] = useState("");
  const [day,   setDay]   = useState("");
  const [year,  setYear]  = useState("");
  const [error, setError] = useState<string | null>(null);
  const [name,  setName]  = useState("");

  const dayRef  = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleConfirmReturning = () => {
    if (!remembered || !rememberedName) return;
    applyRememberedVerification(remembered);
    setGuestName(rememberedName);
    onConfirm();
  };

  const handleNotMe = () => {
    clearRememberedVerification();
    clearRememberedGuestName();
    setStep("birthdate");
  };

  const digitsOnly = (s: string) => s.replace(/\D/g, "");

  const handleMonthChange = (v: string) => {
    const next = digitsOnly(v).slice(0, 2);
    setMonth(next);
    if (next.length === 2) dayRef.current?.focus();
  };
  const handleDayChange = (v: string) => {
    const next = digitsOnly(v).slice(0, 2);
    setDay(next);
    if (next.length === 2) yearRef.current?.focus();
  };
  const handleYearChange = (v: string) => {
    setYear(digitsOnly(v).slice(0, 4));
  };

  const handleSubmitBirthdate = () => {
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);

    if (!isValidBirthdate(y, m, d)) {
      setError("Please enter a valid date of birth.");
      return;
    }

    setError(null);
    const age = calculateAge(y, m, d);
    recordVerification(age, legalAge);

    // Both 21+ and underage guests move on to the name step — everyone
    // gets addressed by name, only the menu differs by age.
    setStep("name");
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const handleSubmitName = () => {
    setGuestName(name);
    // Always let the guest into the app — an underage guest sees a
    // non-alcoholic-only menu instead of being blocked outright.
    onConfirm();
  };

  const isComplete = month.length > 0 && day.length > 0 && year.length === 4;

  return (
    <div
      className="fixed inset-0 z-[999] bg-void/98 backdrop-blur-xl flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-desc"
    >
      {/* Ambient */}
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage:"radial-gradient(circle,rgba(30,48,72,0.5) 1px,transparent 1px)", backgroundSize:"28px 28px" }}
      />

      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-sm animate-scale-in"
      >
        {/* Card */}
        <div className="bg-card border border-edge rounded-3xl overflow-hidden shadow-modal">
          <div className="h-[2px] bg-gold-grad" />

          {step === "welcome-back" ? (
            <div className="p-7 text-center space-y-5">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-felt-grad mx-auto flex items-center justify-center shadow-btn-felt">
                <UserRound size={30} className="text-white" strokeWidth={1.8} />
              </div>

              {/* Title */}
              <div>
                <h2 id="age-gate-title" className="font-display text-2xl font-semibold text-white mb-2">
                  Welcome back, {rememberedName}!
                </h2>
                <p id="age-gate-desc" className="text-mist-300 text-sm font-body leading-relaxed">
                  Is this still you? We'll skip re-entering your birthdate.
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2.5">
                <button
                  onClick={handleConfirmReturning}
                  className="w-full py-4 rounded-2xl font-body font-bold text-base transition-all active:scale-[0.98] bg-felt-grad text-white shadow-btn-felt hover:brightness-110 flex items-center justify-center gap-1.5"
                >
                  Yes, that's me
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={handleNotMe}
                  className="w-full py-3 rounded-2xl font-body font-semibold text-sm text-mist-400 hover:text-white transition-colors"
                >
                  Not me — use a different name
                </button>
              </div>
            </div>
          ) : step === "birthdate" ? (
            <div className="p-7 text-center space-y-5">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gold-grad mx-auto flex items-center justify-center shadow-btn-gold">
                <ShieldCheck size={30} className="text-void" strokeWidth={1.8} />
              </div>

              {/* Title */}
              <div>
                <h2
                  id="age-gate-title"
                  className="font-display text-2xl font-semibold text-white mb-2"
                >
                  Age Verification
                </h2>
                <p id="age-gate-desc" className="text-mist-300 text-sm font-body leading-relaxed">
                  This service includes alcoholic beverages.
                  <br />Please enter your date of birth to continue.
                </p>
              </div>

              {/* Date of birth input */}
              <div>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="MM"
                    aria-label="Birth month"
                    value={month}
                    onChange={e => handleMonthChange(e.target.value)}
                    className="w-16 text-center bg-lift border border-edge rounded-xl py-3 text-white font-mono text-lg placeholder-mist-600 focus:outline-none focus:border-gold-500/40 transition-colors"
                  />
                  <span className="text-mist-600 font-mono" aria-hidden>/</span>
                  <input
                    ref={dayRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="DD"
                    aria-label="Birth day"
                    value={day}
                    onChange={e => handleDayChange(e.target.value)}
                    className="w-16 text-center bg-lift border border-edge rounded-xl py-3 text-white font-mono text-lg placeholder-mist-600 focus:outline-none focus:border-gold-500/40 transition-colors"
                  />
                  <span className="text-mist-600 font-mono" aria-hidden>/</span>
                  <input
                    ref={yearRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="YYYY"
                    aria-label="Birth year"
                    value={year}
                    onChange={e => handleYearChange(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmitBirthdate()}
                    className="w-20 text-center bg-lift border border-edge rounded-xl py-3 text-white font-mono text-lg placeholder-mist-600 focus:outline-none focus:border-gold-500/40 transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-xs font-body mt-2" role="alert">{error}</p>
                )}
              </div>

              {/* Staff verification disclaimer */}
              <div className="bg-lift/60 border border-edge rounded-xl px-4 py-3">
                <p className="text-mist-500 text-xs font-body leading-relaxed">
                  Service staff will verify ID upon delivery. Any order found to be placed by a guest under
                  the legal age of <strong className="text-mist-300">{legalAge}</strong> will be voided immediately.
                </p>
              </div>

              {/* Action */}
              <button
                onClick={handleSubmitBirthdate}
                disabled={!isComplete}
                className={cn(
                  "w-full py-4 rounded-2xl font-body font-bold text-base transition-all active:scale-[0.98]",
                  isComplete
                    ? "bg-felt-grad text-white shadow-btn-felt hover:brightness-110"
                    : "bg-lift border border-edge text-mist-600 cursor-not-allowed",
                )}
              >
                Confirm
              </button>
            </div>
          ) : (
            <div className="p-7 text-center space-y-5 animate-fade-in">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-felt-grad mx-auto flex items-center justify-center shadow-btn-felt">
                <UserRound size={30} className="text-white" strokeWidth={1.8} />
              </div>

              {/* Title */}
              <div>
                <h2 id="age-gate-title" className="font-display text-2xl font-semibold text-white mb-2">
                  What should we call you?
                </h2>
                <p id="age-gate-desc" className="text-mist-300 text-sm font-body leading-relaxed">
                  So our staff can greet you by name when your order arrives.
                </p>
              </div>

              {/* Name input */}
              <input
                ref={nameRef}
                type="text"
                autoComplete="off"
                maxLength={NAME_MAX_LEN}
                placeholder="First name or nickname"
                aria-label="Name you'd like to be called"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmitName()}
                className="w-full text-center bg-lift border border-edge rounded-xl py-3 text-white font-body text-base placeholder-mist-600 focus:outline-none focus:border-gold-500/40 transition-colors"
              />

              {/* Action */}
              <button
                onClick={handleSubmitName}
                className="w-full py-4 rounded-2xl font-body font-bold text-base transition-all active:scale-[0.98] bg-felt-grad text-white shadow-btn-felt hover:brightness-110 flex items-center justify-center gap-1.5"
              >
                {name.trim() ? "Continue" : "Skip for now"}
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-mist-700 font-mono mt-4 px-4">
          {venueName} — Licensed beverage service.
          <br />Please drink responsibly.
        </p>
      </div>
    </div>
  );
}

// Shown when guest fails age verification — permanent end state, not retryable
export function AgeGateDeclined() {
  return (
    <main className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-lift border border-edge mx-auto flex items-center justify-center mb-5">
          <XCircle size={28} className="text-mist-600" strokeWidth={1.5} />
        </div>
        <h2 className="font-display text-2xl text-white mb-2">Service Unavailable</h2>
        <p className="text-mist-400 text-sm font-body leading-relaxed">
          Our beverage ordering service is only available to guests of legal age.
          Please speak with a member of our service staff if you need assistance.
        </p>
      </div>
    </main>
  );
}
