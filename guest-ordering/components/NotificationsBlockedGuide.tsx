"use client";

/**
 * NotificationsBlockedGuide — shown when a guest has already tapped
 * "Don't Allow". Browsers permanently suppress the native permission popup
 * once truly denied (anti-spam behavior in iOS Safari, Chrome, etc.) — there
 * is no programmatic way to re-trigger it. The only real fix is the guest
 * manually flipping it back on in their own device/browser settings, so this
 * just shows exactly where that setting lives, split by platform.
 *
 * Rendered via a portal for the same reason as IOSInstallGuide — this can be
 * triggered from inside a fade-up-animated card, whose permanent transform
 * would otherwise trap a "fixed" overlay inside that small card.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Bell, Settings } from "lucide-react";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function NotificationsBlockedGuide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const steps = isIOS()
    ? [
        "Open the iPhone Settings app",
        "Scroll down and tap POUR",
        "Turn on Allow Notifications",
      ]
    : isAndroid()
    ? [
        "Tap the lock/info icon next to the address bar (or open Chrome menu → Site settings)",
        "Tap Notifications",
        "Choose Allow",
      ]
    : [
        "Click the lock/info icon next to the address bar",
        "Find Notifications in the site settings list",
        "Change it to Allow",
      ];

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] bg-void/85 backdrop-blur-md animate-fade-in" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex sm:items-center sm:justify-center sm:p-4 pointer-events-none">
        <div className="pointer-events-auto w-full h-full sm:h-auto sm:max-w-md sm:max-h-[85vh] bg-card sm:rounded-3xl shadow-modal flex flex-col animate-sheet-up">
          <div className="h-[3px] w-full bg-gold-grad flex-shrink-0" />

          <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge flex-shrink-0 pt-[calc(0.875rem+env(safe-area-inset-top))]">
            <h3 className="font-display text-xl font-semibold text-white leading-none">Turn notifications back on</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-lift flex items-center justify-center text-mist-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="flex items-center gap-3 bg-gold-500/8 border border-gold-500/25 rounded-2xl px-4 py-3">
              <div className="w-11 h-11 rounded-xl bg-lift border border-edge flex items-center justify-center flex-shrink-0">
                <Bell size={22} className="text-gold-300" />
              </div>
              <p className="text-mist-200 text-xs font-body leading-snug">
                You previously chose <span className="text-white font-semibold">"Don't Allow"</span>. Your browser won't ask again automatically — you'll need to turn it back on manually, just this once.
              </p>
            </div>

            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-lift/60 border border-edge rounded-2xl px-3.5 py-3">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center shadow-btn-gold">
                    <Settings size={18} className="text-void" />
                  </div>
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-felt-grad text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-btn-felt">
                    {i + 1}
                  </span>
                </div>
                <p className="text-white font-body text-sm leading-snug pt-1.5">{s}</p>
              </div>
            ))}

            <button
              onClick={onClose}
              className="w-full mt-1 py-3 rounded-2xl font-body font-bold text-sm bg-felt-grad text-white shadow-btn-felt hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
