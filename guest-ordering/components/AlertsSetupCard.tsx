"use client";

/**
 * AlertsSetupCard — lets a guest set up delivery alerts BEFORE they order,
 * from the menu screen, so they're not doing the install/permission dance
 * mid-checkout. It only pre-grants (install + notification permission); the
 * actual per-order push subscription still happens on the confirmation screen
 * (PushOptIn), which is silent once permission is already granted here.
 *
 * Self-hides once there's nothing left to do (permission granted or denied,
 * or push unsupported). Deliberately NOT dismissible — a guest who closes it
 * would lose the chance to enable alerts before ordering, since this card
 * doesn't reappear on refresh (there'd be no way back to it this session).
 */

import { useCallback, useEffect, useState } from "react";
import { BellRing, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPushSupported, pushPermission } from "@/lib/push";
import { IOSInstallGuide } from "./IOSInstallGuide";

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

type Mode = "hidden" | "ios-install" | "enable";

export function AlertsSetupCard() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);

  const compute = useCallback(() => {
    if (typeof window === "undefined") return;

    // iOS Safari (not installed) can't do push at all until added to Home Screen.
    if (isIOS() && !isStandalone() && !isPushSupported()) { setMode("ios-install"); return; }

    if (isPushSupported()) {
      const perm = pushPermission();
      // Only offer if the guest hasn't decided yet. Once granted, per-order
      // subscribe is silent on the confirmation screen; once denied, nagging
      // won't help.
      setMode(perm === "default" ? "enable" : "hidden");
      return;
    }
    setMode("hidden");
  }, []);

  useEffect(() => { compute(); }, [compute]);

  const enable = async () => {
    setBusy(true);
    try {
      // Request synchronously in the gesture (iOS requirement). No order yet, so
      // we only pre-grant permission here — no subscription is created.
      const perm = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      setMode(perm === "granted" ? "hidden" : "hidden"); // either way, collapse
    } catch {
      setMode("hidden");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "hidden") return null;

  return (
    <div className="px-4 pb-2 animate-fade-up">
      <div className="max-w-lg mx-auto bg-card border border-gold-500/20 rounded-2xl p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center flex-shrink-0 shadow-btn-gold">
          <BellRing size={18} className="text-void" />
        </div>

        {mode === "ios-install" ? (
          <>
            <button onClick={() => setShowGuide(true)} className="min-w-0 flex-1 text-left">
              <p className="text-white font-body font-semibold text-sm leading-tight">Get order alerts on your phone</p>
              <p className="text-mist-400 text-xs font-body mt-0.5 leading-snug">Add POUR to your Home Screen — tap to see how.</p>
            </button>
            <ChevronRight size={18} className="text-gold-400 flex-shrink-0" onClick={() => setShowGuide(true)} />
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
                busy ? "bg-lift border border-edge text-mist-500" : "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
              )}
            >
              {busy ? "…" : "Turn on"}
            </button>
          </>
        )}
      </div>

      {showGuide && <IOSInstallGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
