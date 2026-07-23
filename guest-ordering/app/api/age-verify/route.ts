import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// This endpoint is public and unauthenticated by necessity (the age gate
// runs before a guest has any other identity) — rate-limiting is the only
// thing standing between it and being hammered. Own budget, not shared with
// the order/payment limiters.
const isRateLimited = createRateLimiter(60_000, 10);

// Must match lib/ageGate.ts's ageBracket() exactly — rejects anything else
// server-side rather than storing arbitrary client-supplied strings.
const VALID_AGE_BRACKETS = new Set([
  "under_legal_age", "21-24", "25-34", "35-44", "45-54", "55-64", "65+",
]);

/**
 * Logs one age-verification outcome server-side via the
 * record_age_verification SECURITY DEFINER RPC (RLS-locked table, no direct
 * anon access — same lockdown pattern as pending_orders/push_subscriptions).
 *
 * Called fire-and-forget by the client right after the age gate is
 * completed (lib/ageGate.ts's reportAgeVerification). Never receives or
 * stores the birthdate itself — only the coarse bracket already computed
 * client-side, plus a boolean. This is the row computeOrderCharge later
 * checks server-side before allowing alcoholic items into an order.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  let body: { guestId?: string; ageBracket?: string; isUnderage?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { guestId, ageBracket, isUnderage } = body;
  if (!guestId || !ageBracket || typeof isUnderage !== "boolean") {
    return NextResponse.json({ error: "Missing guestId, ageBracket, or isUnderage" }, { status: 400 });
  }
  if (!VALID_AGE_BRACKETS.has(ageBracket)) {
    return NextResponse.json({ error: "Invalid ageBracket" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.rpc("record_age_verification", {
    p_guest_id: String(guestId),
    p_age_bracket: String(ageBracket).slice(0, 32),
    p_is_underage: isUnderage,
  });

  if (error) {
    logError("record_age_verification failed", new Error(error.message), { guestId, ageBracket, isUnderage });
    return NextResponse.json({ error: "Could not record age verification" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
