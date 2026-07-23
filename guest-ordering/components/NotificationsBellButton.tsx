"use client";

/**
 * NotificationsBellButton — persistent header entry point back into the
 * push-notification setup flow, for a guest who dismissed AlertsSetupCard
 * ("Not now") and would otherwise have no way to turn alerts on later.
 *
 * Only appears once AlertsSetupCard has actually been dismissed AND there's
 * still something worth re-offering (permission is still "default", or iOS
 * Safari hasn't been added to the Home Screen yet). Once permission is
 * granted or denied there's nothing left for this button to do — "denied"
 * is already handled by AlertsSetupCard staying visible on its own, so this
 * button doesn't need to cover that case.
 */

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { isPushSupported, pushPermission } from "@/lib/push";
import { IOSInstallGuide } from "./IOSInstallGuide";

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

type Mode = "hidden" | "ios-install" | "enable";

export function NotificationsBellButton() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);

  const compute = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!isDismissed()) { setMode("hidden"); return; }

    if (isIOS() && !isStandalone() && !isPushSupported()) {
      setMode("ios-install");
      return;
    }
    if (isPushSupported() && pushPermission() === "default") {
      setMode("enable");
      return;
    }
    setMode("hidden");
  }, []);

  useEffect(() => { compute(); }, [compute]);

  // Same reasoning as AlertsSetupCard: permission can only change via the
  // guest leaving to device/browser Settings (or the Home Screen install
  // guide) and back, so re-derive on return to the tab.
  useEffect(() => {
    document.addEventListener("visibilitychange", compute);
    window.addEventListener("focus", compute);
    return () => {
      document.removeEventListener("visibilitychange", compute);
      window.removeEventListener("focus", compute);
    };
  }, [compute]);

  const handleClick = async () => {
    if (mode === "ios-install") { setShowGuide(true); return; }
    setBusy(true);
    try {
      await Notification.requestPermission();
    } finally {
      setBusy(false);
      compute();
    }
  };

  if (mode === "hidden") return null;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        aria-label="Turn on order alerts"
        className="h-10 w-10 rounded-xl bg-lift border border-rim flex items-center justify-center text-gold-400 hover:border-gold-600/50 transition-colors flex-shrink-0"
      >
        <BellRing size={16} />
      </button>
      {showGuide && <IOSInstallGuide onClose={() => { setShowGuide(false); compute(); }} />}
    </>
  );
}
