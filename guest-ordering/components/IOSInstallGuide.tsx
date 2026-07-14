"use client";

/**
 * IOSInstallGuide — step-by-step "Add to Home Screen" sheet for iPhone.
 *
 * iOS blocks any programmatic way to open the Share sheet or trigger install,
 * so this makes the manual steps unmissable. Deliberately does NOT try to point
 * an arrow at the physical Share button — this sheet covers the bottom of the
 * screen where that button lives, so a pointer would be misleading. Instead it
 * shows the actual Share glyph clearly ("look for this icon") and explains that
 * Safari's toolbar can be hidden and how to reveal it.
 */

import { useEffect } from "react";
import { Plus, BellRing, X, SquareArrowUp, MoveVertical } from "lucide-react";

export function IOSInstallGuide({ onClose }: { onClose: () => void }) {
  // Lock body scroll while open — on iOS Safari a scrollable body behind a
  // fixed overlay can steal touch/scroll gestures meant for the sheet itself.
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  const steps = [
    {
      icon: <SquareArrowUp size={18} className="text-void" />,
      title: "Tap the Share button in Safari",
      body: "It's the square-with-an-up-arrow icon in Safari's toolbar. If you don't see the toolbar, tap once near the bottom edge of the screen to bring it back.",
    },
    {
      icon: <Plus size={18} className="text-void" />,
      title: "Choose “Add to Home Screen”",
      body: "In the share menu, swipe down through the list of options until you see “Add to Home Screen,” then tap it.",
    },
    {
      icon: <BellRing size={18} className="text-void" />,
      title: "Open POUR from the new icon",
      body: "Tap “Add” (top-right), then launch POUR from your Home Screen and tap “Enable delivery alerts.”",
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-void/85 backdrop-blur-md animate-fade-in" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center pointer-events-none sm:p-4">
        <div className="pointer-events-auto w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-modal flex flex-col max-h-[85dvh] animate-sheet-up pb-[env(safe-area-inset-bottom)]">
          <div className="h-[3px] w-full bg-gold-grad flex-shrink-0" />

          <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge flex-shrink-0">
            <h3 className="font-display text-xl font-semibold text-white leading-none">Add POUR to your iPhone</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-lift flex items-center justify-center text-mist-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3" style={{ WebkitOverflowScrolling: "touch" }}>
            <p className="text-mist-400 text-xs font-body">
              iPhone only allows lock-screen alerts once POUR is on your Home Screen. It takes about 10 seconds — close this and follow these steps in Safari:
            </p>

            {/* "Look for this icon" callout — the real Share glyph, so they can
                recognize it rather than being pointed at a covered button. */}
            <div className="flex items-center gap-3 bg-gold-500/8 border border-gold-500/25 rounded-2xl px-4 py-3">
              <div className="w-11 h-11 rounded-xl bg-lift border border-edge flex items-center justify-center flex-shrink-0">
                <SquareArrowUp size={22} className="text-gold-300" />
              </div>
              <p className="text-mist-200 text-xs font-body leading-snug">
                <span className="text-white font-semibold">This is the Share icon.</span> Look for it in Safari's toolbar — not on this page.
              </p>
            </div>

            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-lift/60 border border-edge rounded-2xl px-3.5 py-3">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center shadow-btn-gold">
                    {s.icon}
                  </div>
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-felt-grad text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-btn-felt">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-body font-semibold text-sm leading-tight">{s.title}</p>
                  <p className="text-mist-400 text-xs font-body mt-0.5 leading-snug">{s.body}</p>
                </div>
              </div>
            ))}

            {/* Toolbar-hidden tip — the single most common stumbling block. */}
            <div className="flex items-center gap-2 text-xs font-body text-mist-400 bg-lift/40 border border-edge rounded-xl px-3 py-2.5">
              <MoveVertical size={14} className="text-felt-400 flex-shrink-0" />
              <span>Can't find Safari's toolbar? Tap near the very bottom of the screen and it slides back up.</span>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-1 py-3 rounded-2xl font-body font-bold text-sm bg-felt-grad text-white shadow-btn-felt hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
