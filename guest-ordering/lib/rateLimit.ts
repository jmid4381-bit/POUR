/**
 * lib/rateLimit.ts — shared in-memory per-IP rate limiter for API routes.
 *
 * Best-effort: resets on cold start and isn't shared across regions/instances.
 * Sufficient to deter a casual script hammering a single route. Each route
 * should create its own limiter instance (own Map) so one endpoint's traffic
 * can't burn through another's budget.
 */

export function createRateLimiter(windowMs: number, maxPerWindow: number) {
  const hits = new Map<string, number[]>();
  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > maxPerWindow;
  };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// Shared wording across every rate-limited route, so a guest sees the same
// clear "it didn't go through, here's why, try again in ~1 minute" message
// regardless of which endpoint (free order, Stripe payment) rejected them.
export const RATE_LIMIT_MESSAGE =
  "Your order didn't go through — you're ordering too quickly. Please try again in about a minute.";
