/**
 * Server/edge-side Sentry init. Next.js calls register() once on server start.
 * Gated on SENTRY_DSN — a safe no-op until the env var is actually set.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

// Automatically reports errors thrown inside Server Components / route
// handlers that Next.js itself catches, without needing to wrap every route.
export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
