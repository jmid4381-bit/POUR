"use client";

/**
 * AlertsSetupCard — lets a guest set up delivery alerts BEFORE they order,
 * from the menu screen, so they're not doing the install/permission dance
 * mid-checkout. It only pre-grants (install + notification permission); the
 * actual per-order push subscription still happens on the confirmation screen
 * (PushOptIn), which is silent once permission is already granted here.
 *
 * Self-hides only once permission is actually GRANTED (or push is
 * unsupported) — there's nothing left to do at that point. A "denied"
 * outcome stays visible as a tappable card explaining how to re-enable via
 * device settings, since the browser will never show the native prompt
 * again on its own; that opportunity should never just vanish, and an
 * explicit "Not now" dismiss never applies to it either — it's a real,
 * fixable problem, not a soft ask.
 *
 * The soft "enable"/"ios-install" ask, though, IS explicitly dismissible via
 * "Not now" (localStorage, survives across visits) — without it, a guest who
 * simply doesn't want notifications sees this card at the top of the menu
 * on every single future visit, forever, with no way to say stop. Within a
 * session it still doesn't reappear once closed (there'd be no way back to
 * it), same as before "Not now" existed — the persisted flag just makes
 * that hold across sessions too, instead of resetting on every fresh visit.
 */

import { useCallback, useEffect, useState } from "react";
import { BellRing, ChevronRight, BellOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPushSupported, pushPermission } from "@/lib/push";
import { IOSInstallGuide } from "./IOSInstallGuide";
import { NotificationsBlockedGuide } from "./NotificationsBlockedGuide";

const DISMISSED_KEY = "pour_alerts_card_dismissed";

function isDismissed(): boolean {
  try { return localStorage.getItem(DISMISSED_KEY) === "true"; }
  catch { return false; }
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

type Mode = "hidden" | "ios-install" | "enable" | "denied";

export function AlertsSetupCard() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [showGuide, setShowGuide] = useState(false);
  const [showBlockedGuide, setShowBlockedGuide] = useState(false);
  const [busy, setBusy] = useState(false);

  const compute = useCallback(() => {
    if (typeof window === "undefined") return;
    const dismissed = isDismissed();

    // iOS Safari (not installed) can't do push at all until added to Home Screen.
    if (isIOS() && !isStandalone() && !isPushSupported()) {
      setMode(dismissed ? "hidden" : "ios-install");
      return;
    }

    if (isPushSupported()) {
      const perm = pushPermission();
      // "granted" collapses (nothing left to do — the per-order subscribe on
      // the confirmation screen is silent from here on). "denied" stays
      // visible regardless of "Not now" — it's a real fixable problem, not
      // a soft ask, and tapping it explains how to re-enable via device
      // settings, since the browser will never show the native prompt
      // again on its own.
      if (perm === "default") setMode(dismissed ? "hidden" : "enable");
      else if (perm === "denied") setMode("denied");
      else setMode("hidden");
      return;
    }
    setMode("hidden");
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, "true"); } catch { /* ignore */ }
    setMode("hidden");
  };

  useEffect(() => { compute(); }, [compute]);

  // Re-check on return to the tab — the ONLY way this card's permission state
  // can change is the guest leaving to their device/browser Settings and back
  // (there's no in-app control for it). compute() fully re-derives the mode
  // from scratch, so this naturally handles both directions: Settings ->
  // Allow makes the "blocked" card disappear, and Settings -> revoke brings
  // it back even after it had been granted.
  useEffect(() => {
    document.addEventListener("visibilitychange", compute);
    window.addEventListener("focus", compute);
    return () => {
      document.removeEventListener("visibilitychange", compute);
      window.removeEventListener("focus", compute);
    };
  }, [compute]);

  const enable = async () => {
    setBusy(true);
    try {
      // Request synchronously in the gesture (iOS requirement). No order yet, so
      // we only pre-grant permission here — no subscription is created.
      const perm = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      setMode(perm === "denied" ? "denied" : "hidden");
    } catch {
      setMode("hidden");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "hidden") return null;

  return (
    <div className="px-4 pb-2 animate-fade-up">
      <div className={cn(
        "max-w-lg mx-auto border rounded-2xl p-3.5 flex items-center gap-3",
        mode === "denied" ? "bg-card border-edge" : "bg-card border-gold-500/20",
      )}>
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
          mode === "denied" ? "bg-lift" : "bg-gold-grad shadow-btn-gold",
        )}>
          {mode === "denied"
            ? <BellOff size={18} className="text-mist-400" />
            : <BellRing size={18} className="text-void" />}
        </div>

        {mode === "ios-install" ? (
          <>
            <button onClick={() => setShowGuide(true)} className="min-w-0 flex-1 text-left">
              <p className="text-white font-body font-semibold text-sm leading-tight">Get order alerts on your phone</p>
              <p className="text-mist-400 text-xs font-body mt-0.5 leading-snug">Add POUR to your Home Screen — tap to see how.</p>
            </button>
            <ChevronRight size={18} className="text-gold-400 flex-shrink-0" onClick={() => setShowGuide(true)} />
            <button
              onClick={dismiss}
              aria-label="Not now — don't ask again"
              className="w-8 h-8 -mr-1 flex items-center justify-center text-mist-500 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={15} />
            </button>
          </>
        ) : mode === "denied" ? (
          <>
            <button onClick={() => setShowBlockedGuide(true)} className="min-w-0 flex-1 text-left">
              <p className="text-white font-body font-semibold text-sm leading-tight">Notifications are blocked</p>
              <p className="text-mist-400 text-xs font-body mt-0.5 leading-snug">Tap to see how to turn them back on.</p>
            </button>
            <ChevronRight size={18} className="text-mist-400 flex-shrink-0" onClick={() => setShowBlockedGuide(true)} />
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-white font-body font-semibold text-sm leading-tight">Turn on order alerts</p>
              <p className="text-mist-400 text-xs font-body mt-0.5 leading-snug">Know the moment your drinks are on the way.</p>
            </div>
            <button
              onClick={enable}
              disabled={busy}
              className={cn(
                "flex-shrink-0 px-3.5 py-2 rounded-xl font-body font-bold text-xs transition-all active:scale-95",
                busy ? "bg-lift border border-edge text-mist-400" : "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
              )}
            >
              {busy ? "…" : "Turn on"}
            </button>
            <button
              onClick={dismiss}
              disabled={busy}
              aria-label="Not now — don't ask again"
              className="w-8 h-8 -mr-1 flex items-center justify-center text-mist-500 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>

      {showGuide && <IOSInstallGuide onClose={() => setShowGuide(false)} />}
      {showBlockedGuide && <NotificationsBlockedGuide onClose={() => setShowBlockedGuide(false)} />}
    </div>
  );
}
