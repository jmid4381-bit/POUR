"use client";

/**
 * PushOptIn — the "get notified even if you close this page" card shown on the
 * order confirmation screen. Handles the three real-world cases:
 *
 *  1. Push-capable browser (Android/Chrome, or an installed iOS PWA) → show an
 *     Enable button that requests permission and subscribes this device.
 *  2. iOS Safari in a normal tab → Web Push is impossible until the site is
 *     added to the Home Screen, so show that instruction instead of a button
 *     that can't work.
 *  3. Unsupported / already-enabled / denied → collapse to a quiet status line.
 */

import { useEffect, useState } from "react";
import { BellRing, BellOff, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrCreateGuestId } from "@/lib/guestSession";
import { isPushSupported, pushPermission, subscribeForOrder } from "@/lib/push";
import { IOSInstallGuide } from "./IOSInstallGuide";

type UIState = "loading" | "prompt" | "enabling" | "enabled" | "denied" | "ios-install" | "unsupported";

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

export function PushOptIn({ orderId }: { orderId: string }) {
  const [state, setState] = useState<UIState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // iOS in a normal Safari tab can't do push until installed to Home Screen.
    if (isIOS() && !isStandalone() && !isPushSupported()) {
      setState("ios-install");
      return;
    }
    if (!isPushSupported()) { setState("unsupported"); return; }
    const perm = pushPermission();
    if (perm === "denied") { setState("denied"); return; }
    if (perm === "granted") {
      // Permission already granted from a previous order — silently register
      // THIS order too, so every order gets alerts, not just the first one
      // that triggered the prompt. Subscriptions are keyed per order, so a new
      // order needs its own row or it would never be notified.
      setState("enabling");
      subscribeForOrder(orderId, getOrCreateGuestId()).then((res) => {
        if (res.ok) { setState("enabled"); return; }
        // Fall back to the manual prompt if the silent re-subscribe failed.
        setError(`Couldn't turn on alerts for this order (${res.reason}${res.detail ? `: ${res.detail}` : ""}).`);
        setState("prompt");
      });
      return;
    }
    setState("prompt");
    // Re-run per order so each new confirmation screen re-registers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const enable = async () => {
    setError(null);

    // iOS is strict: Notification.requestPermission() must run synchronously at
    // the very START of the tap handler, before any await or heavy work, or the
    // system prompt silently never appears. So request it here FIRST, then hand
    // off to the (async) subscribe step.
    let permission: NotificationPermission;
    try {
      permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    } catch (e) {
      setError(`Permission request failed: ${(e as Error)?.message ?? "unknown"}`);
      return;
    }

    if (permission === "denied") { setState("denied"); return; }
    if (permission !== "granted") { setError("Notifications weren't allowed. Tap to try again."); return; }

    setState("enabling");
    const res = await subscribeForOrder(orderId, getOrCreateGuestId());
    if (res.ok) { setState("enabled"); return; }
    if (res.reason === "denied") { setState("denied"); return; }
    // Surface the real reason on-device — push failures are otherwise invisible.
    setError(`Couldn't enable alerts (${res.reason}${res.detail ? `: ${res.detail}` : ""}). Tap to retry.`);
    setState("prompt");
  };

  if (state === "loading" || state === "unsupported") return null;

  // Quiet confirmation once enabled.
  if (state === "enabled") {
    return (
      <div className="bg-card border border-felt-500/20 rounded-2xl p-4 flex items-center gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-xl bg-felt-grad flex items-center justify-center flex-shrink-0 shadow-btn-felt">
          <Check size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-body font-semibold text-sm">Alerts on for this order</p>
          <p className="text-felt-400/80 text-xs font-body mt-0.5">We'll notify you when it's on the way and delivered.</p>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="bg-card border border-edge rounded-2xl p-4 flex items-center gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-xl bg-lift flex items-center justify-center flex-shrink-0">
          <BellOff size={18} className="text-mist-400" />
        </div>
        <div>
          <p className="text-white font-body font-semibold text-sm">Notifications are blocked</p>
          <p className="text-mist-500 text-xs font-body mt-0.5">Enable notifications for this site in your browser settings to get delivery alerts.</p>
        </div>
      </div>
    );
  }

  if (state === "ios-install") {
    return (
      <>
        <button
          onClick={() => setShowGuide(true)}
          className="w-full text-left bg-card border border-gold-500/20 rounded-2xl p-4 animate-fade-up active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center flex-shrink-0 shadow-btn-gold">
              <BellRing size={18} className="text-void" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-body font-semibold text-sm">Get delivery alerts on iPhone</p>
              <p className="text-mist-400 text-xs font-body mt-0.5">Add POUR to your Home Screen — tap to see how.</p>
            </div>
            <ChevronRight size={18} className="text-gold-400 flex-shrink-0" />
          </div>
        </button>

        {showGuide && <IOSInstallGuide onClose={() => setShowGuide(false)} />}
      </>
    );
  }

  // state === "prompt" | "enabling"
  return (
    <div className="bg-card border border-gold-500/20 rounded-2xl p-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center flex-shrink-0 shadow-btn-gold">
          <BellRing size={18} className="text-void" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-body font-semibold text-sm">Get notified when it's ready</p>
          <p className="text-mist-400 text-xs font-body mt-0.5">Even if you close this page or lock your phone.</p>
        </div>
      </div>
      {error && <p className="text-red-400 text-xs font-body mt-2">{error}</p>}
      <button
        onClick={enable}
        disabled={state === "enabling"}
        className={cn(
          "w-full mt-3 py-2.5 rounded-xl font-body font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
          state === "enabling"
            ? "bg-lift border border-edge text-mist-500 cursor-not-allowed"
            : "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
        )}
      >
        {state === "enabling" ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enabling…</>
        ) : (
          <><BellRing size={16} /> Enable delivery alerts</>
        )}
      </button>
    </div>
  );
}
