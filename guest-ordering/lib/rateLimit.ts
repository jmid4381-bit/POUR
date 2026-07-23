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
