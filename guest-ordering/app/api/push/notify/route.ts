import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getWebPush, isPushConfigured } from "@/lib/webpush";

export const runtime = "nodejs";

/**
 * Push-send endpoint, called by a Supabase Database Webhook on every UPDATE to
 * the `orders` table. It fires an OS push notification when the order crosses
 * a milestone — "being prepared", "on the way", "delivered" — the server-side
 * source of truth, so it works even with the guest's tab closed.
 *
 * Auth: a shared secret in the `x-webhook-secret` header (PUSH_WEBHOOK_SECRET),
 * so only our Supabase webhook can trigger sends, not the public internet.
 */

// Same step mapping as the client's statusToStep (components/OrderConfirmation.tsx)
// so "accepted" and "preparing" collapse into ONE "being prepared" notification
// instead of firing twice for what the guest sees as a single step.
function stepFor(status: string): number {
  switch (status) {
    case "pending":   return 0;
    case "accepted":
    case "preparing": return 1;
    case "ready":     return 2;
    case "delivered": return 3;
    default:          return 0;
  }
}

// Copy per step crossed INTO (index = destination step).
const STEP_COPY: Record<number, { title: string; body: string; bright: boolean }> = {
  1: { title: "Your order is being prepared! 🍹", body: "A bartender just started on your drinks.",     bright: false },
  2: { title: "Your order is on the way! 🍹",      body: "A server is bringing it to your seat now.",    bright: false },
  3: { title: "Delivered — enjoy! 🎉",             body: "Your order just arrived at your seat.",        bright: true  },
};

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: { id?: string; status?: string } | null;
  old_record?: { status?: string } | null;
}

export async function POST(req: NextRequest) {
  // Always 200 on auth/config problems is wrong — a bad secret should 401 so
  // it's visible in Supabase's webhook logs. But once past auth, we swallow
  // per-subscription errors and still 200 so Supabase doesn't retry-storm.
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    // Push not set up yet — accept and no-op so the webhook isn't seen as failing.
    return NextResponse.json({ ok: true, skipped: "push-not-configured" });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (payload.table !== "orders" || payload.type !== "UPDATE" || !payload.record?.id) {
    return NextResponse.json({ ok: true, skipped: "not-an-order-update" });
  }

  const newStatus = payload.record.status ?? "";
  const oldStatus = payload.old_record?.status ?? "";
  const orderId   = payload.record.id;

  const newStep = stepFor(newStatus);
  const oldStep = stepFor(oldStatus);

  // Only on an UPWARD step crossing (e.g. pending->accepted, accepted->preparing
  // stays at step 1 and does NOT re-fire — same step collapsing as the client).
  if (newStep <= oldStep || !STEP_COPY[newStep]) {
    return NextResponse.json({ ok: true, skipped: "no-notifiable-transition" });
  }
  const copy = STEP_COPY[newStep];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: true, skipped: "no-supabase" });

  const supabase = createClient(url, key);
  const { data: subs, error } = await supabase.rpc("get_push_subscriptions_for_order", {
    p_order_id: orderId,
  });
  if (error) {
    console.error("get_push_subscriptions_for_order failed:", error.message);
    return NextResponse.json({ ok: true, skipped: "lookup-failed" });
  }

  const rows: Array<{ endpoint: string; subscription: unknown }> = Array.isArray(subs) ? subs : [];
  if (rows.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const webpush = getWebPush();
  const message = JSON.stringify({
    title: copy.title,
    body: copy.body,
    bright: copy.bright,
    orderId,
    url: "/",
  });

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription as webpushPushSubscription, message);
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = subscription expired/unsubscribed — mark for cleanup.
        if (status === 404 || status === 410) stale.push(row.endpoint);
      }
    }),
  );

  // Best-effort cleanup of dead subscriptions.
  if (stale.length > 0) {
    await Promise.all(
      stale.map((endpoint) =>
        supabase.rpc("delete_push_subscription", { p_endpoint: endpoint }).then(() => {}, () => {}),
      ),
    );
  }

  return NextResponse.json({ ok: true, sent });
}

// web-push's PushSubscription type isn't exported in a convenient shape here;
// the stored JSON already matches what sendNotification expects.
type webpushPushSubscription = Parameters<ReturnType<typeof getWebPush>["sendNotification"]>[0];
