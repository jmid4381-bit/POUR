import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

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
