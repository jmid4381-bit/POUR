"use client";

/**
 * InstallAppCard — one-tap "Install app" for Android/Chrome, where the browser
 * exposes a real programmatic install (unlike iOS, which is instruction-only).
 *
 * Renders nothing unless Chrome has actually offered install (beforeinstallprompt
 * captured) and the app isn't already running installed. So on iOS, desktop, or
 * an already-installed launch it simply doesn't appear.
 */

import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isInstallAvailable, promptInstall } from "@/lib/installPrompt";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppCard() {
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed — nothing to offer
    setAvailable(isInstallAvailable());
    const onAvail = () => setAvailable(true);
    const onGone = () => { setAvailable(false); setInstalled(true); };
    window.addEventListener("pwa-install-available", onAvail);
    window.addEventListener("pwa-install-consumed", onGone);
    return () => {
      window.removeEventListener("pwa-install-available", onAvail);
      window.removeEventListener("pwa-install-consumed", onGone);
    };
  }, []);

  const install = async () => {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === "accepted") { setInstalled(true); setAvailable(false); }
  };

  if (installed) {
    return (
      <div className="bg-card border border-felt-500/20 rounded-2xl p-4 flex items-center gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-xl bg-felt-grad flex items-center justify-center flex-shrink-0 shadow-btn-felt">
          <Check size={18} className="text-white" />
        </div>
        <p className="text-white font-body font-semibold text-sm">POUR added to your home screen</p>
      </div>
    );
  }

  if (!available) return null;

  return (
    <div className="bg-card border border-gold-500/20 rounded-2xl p-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center flex-shrink-0 shadow-btn-gold">
          <Download size={18} className="text-void" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-body font-semibold text-sm">Add POUR to your home screen</p>
          <p className="text-mist-400 text-xs font-body mt-0.5">One tap — reorder faster next time.</p>
        </div>
      </div>
      <button
        onClick={install}
        disabled={busy}
        className={cn(
          "w-full mt-3 py-2.5 rounded-xl font-body font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
          busy
            ? "bg-lift border border-edge text-mist-400 cursor-not-allowed"
            : "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
        )}
      >
        {busy ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Installing…</>
        ) : (
          <><Download size={16} /> Install app</>
        )}
      </button>
    </div>
  );
}
