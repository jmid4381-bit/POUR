/**
 * Server/edge-side Sentry init. Next.js calls register() once on server start.
 * Gated on SENTRY_DSN — a safe no-op until the env var is actually set (same
 * pattern as Stripe/VAPID elsewhere in this app), so deploying this code
 * can't break anything before a real Sentry project exists.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    tracesSampleRate: 0,   // error capture only — no perf tracing, keeps free-tier quota for errors
    sendDefaultPii: false, // guest data (guestId, orderId) is added explicitly per-call, not blanket PII capture
  });
}

// Automatically reports errors thrown inside Server Components / route
// handlers that Next.js itself catches, without needing to wrap every route.
export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
