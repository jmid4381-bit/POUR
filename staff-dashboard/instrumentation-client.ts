/**
 * Browser-side Sentry init. Next.js loads this automatically for the client
 * bundle. Gated on NEXT_PUBLIC_SENTRY_DSN — a safe no-op until set.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}
