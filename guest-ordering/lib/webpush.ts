/**
 * lib/webpush.ts — server-only Web Push sender.
 *
 * Configures the `web-push` library with the VAPID keypair lazily, so the
 * module can be imported anywhere without crashing when the keys aren't set
 * (mirrors lib/stripe.ts). The PRIVATE key is server-only and must never be
 * exposed to the client; only the PUBLIC key is safe in the browser bundle.
 */

import webpush from "web-push";

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

/**
 * Returns the configured web-push client, or throws if the VAPID env vars
 * are missing. Only call this from a code path you know is push-enabled
 * (guard with isPushConfigured() first for graceful no-ops).
 */
export function getWebPush(): typeof webpush {
  if (!isPushConfigured()) {
    throw new Error("Web Push not configured: missing VAPID_* env vars");
  }
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,        // e.g. "mailto:you@example.com"
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return webpush;
}
