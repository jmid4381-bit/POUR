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
  | { ok: false; reason: "unsupported" | "denied" | "unconfigured" | "error" };

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
 * Ask for permission (if not already decided), subscribe, and register the
 * subscription against `orderId` on the server. Must be called from a user
 * gesture on iOS (the opt-in button handler).
 */
export async function subscribeForOrder(orderId: string, guestId: string): Promise<PushResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC)       return { ok: false, reason: "unconfigured" };

  try {
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

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
    if (!res.ok) return { ok: false, reason: "error" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}
