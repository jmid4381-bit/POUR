import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Stores a browser push subscription against an order so the notify webhook
 * can later push "ready"/"delivered" alerts to that device. Writes go through
 * the `save_push_subscription` SECURITY DEFINER RPC — the anon key can't touch
 * the push_subscriptions table directly (RLS enabled, no policies), same
 * lockdown pattern as pending_orders.
 */
export async function POST(req: NextRequest) {
  let body: { orderId?: string; guestId?: string; subscription?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { orderId, guestId, subscription } = body;
  if (!orderId || !subscription || typeof subscription !== "object") {
    return NextResponse.json({ error: "Missing orderId or subscription" }, { status: 400 });
  }

  const sub = subscription as { endpoint?: string };
  if (!sub.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.rpc("save_push_subscription", {
    p_order_id: orderId,
    p_guest_id: guestId ?? null,
    p_endpoint: sub.endpoint,
    p_subscription: subscription,
  });

  if (error) {
    console.error("save_push_subscription failed:", error.message);
    return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
