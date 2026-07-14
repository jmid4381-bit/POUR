"use client";

/**
 * lib/installPrompt.ts — Android/Chrome one-tap PWA install.
 *
 * Chrome fires a `beforeinstallprompt` event when the app meets install
 * criteria (manifest + a registered service worker). We capture and stash it,
 * then let a button trigger the real native install sheet on a user gesture —
 * a genuine one-tap install, unlike iOS which has no programmatic path.
 *
 * The event can fire before the confirmation screen mounts, so we bind the
 * listener as early as possible and notify React via a window event.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let bound = false;

export function initInstallPrompt(): void {
  if (typeof window === "undefined" || bound) return;
  bound = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Stop Chrome's default mini-infobar; we surface our own button instead.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("pwa-install-available"));
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    window.dispatchEvent(new Event("pwa-install-consumed"));
  });
}

export function isInstallAvailable(): boolean {
  return deferred !== null;
}

/** Show the native install sheet. Must be called from a user gesture. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const evt = deferred;
  deferred = null; // a captured prompt can only be used once
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    window.dispatchEvent(new Event("pwa-install-consumed"));
    return outcome;
  } catch {
    return "dismissed";
  }
}
