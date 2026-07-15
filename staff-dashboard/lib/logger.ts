/**
 * lib/logger.ts — single entry point for reporting caught errors.
 *
 * Always console.errors (local dev visibility) AND reports to Sentry.
 * Sentry.captureException is itself a safe no-op if Sentry.init was never
 * called (no DSN configured) — so this needs no separate feature gate.
 */

import * as Sentry from "@sentry/nextjs";

export function logError(message: string, error: unknown, context?: Record<string, unknown>): void {
  console.error(message, error, context ?? "");
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    extra: { message, ...context },
  });
}

/** For non-exception failure signals (e.g. a Realtime channel status). */
export function logMessage(message: string, context?: Record<string, unknown>): void {
  console.warn(message, context ?? "");
  Sentry.captureMessage(message, { level: "warning", extra: context });
}
