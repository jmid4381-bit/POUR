"use client";

/**
 * lib/push.ts — browser-side Web Push subscription helpers.
 *
 * Flow: register the service worker → ask permission → subscribe via the Push
 * API with our VAPID public key → send the subscription to the server, tied to
 * the order so the server can push "ready"/"delivered" alerts to this device.
 *
 * Everything degrades gracefully: unsupported browsers, denied permission, or
 * a missing public key all resolve to a clear result instead of throwing.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "unconfigured" | "error"; detail?: string };

/** True only if this browser can actually do Web Push. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current permission without prompting. */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Back it with an explicit ArrayBuffer so the type is Uint8Array<ArrayBuffer>
  // (not ArrayBufferLike), which is what applicationServerKey/BufferSource wants.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let swRegistration: ServiceWorkerRegistration | null = null;

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (swRegistration) return swRegistration;
  swRegistration = await navigator.serviceWorker.register("/sw.js");
  // Wait until it's active so pushManager.subscribe() is usable immediately.
  await navigator.serviceWorker.ready;
  return swRegistration;
}

/**
 * Register the service worker eagerly on page load (fire-and-forget). Chrome
 * only fires `beforeinstallprompt` (our Android one-tap install) once a service
 * worker is registered, so we can't wait until the guest taps "Enable alerts".
 * Safe no-op where service workers aren't supported.
 */
export function ensureServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/**
 * Subscribe this device and register it against `orderId` on the server.
 *
 * IMPORTANT (iOS): permission must already be granted before calling this —
 * request it synchronously at the very top of the tap handler (see PushOptIn),
 * because iOS silently ignores requestPermission() if any async work runs
 * first. This function assumes permission is granted and only does the
 * service-worker + subscribe + save steps.
 *
 * Returns a detailed reason on failure so the UI can show it on-device (push
 * debugging is otherwise invisible on a phone).
 */
export async function subscribeForOrder(orderId: string, guestId: string): Promise<PushResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC)       return { ok: false, reason: "unconfigured" };
  if (Notification.permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const reg = await getRegistration();

    // Reuse an existing subscription if present, else create one.
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, guestId, subscription: sub.toJSON() }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: "error", detail: `save failed ${res.status} ${body}`.trim() };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", detail: (e as Error)?.message ?? "subscribe threw" };
  }
}
