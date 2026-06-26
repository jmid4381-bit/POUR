"use client";

/**
 * Staff Operations Dashboard
 *
 * Fixes applied on this page:
 *  Fix 1  — audio plays on new order, overdue, delivered
 *  Fix 3  — delivered column capped in KanbanColumn
 *  Fix 4  — NotificationCenter tracks all arrivals permanently
 *  Fix 5  — graduated urgency flows through KanbanCard → LiveTimer
 *  Fix 6  — StaffLogin gate; staffName passed to all actions
 *  Fix 8  — viewport height via flex-1 / min-h-0, no magic-number calc()
 *  Fix 9  — ConnectionStatus + useOnlineStatus in header
 *  Fix 10 — ZoneBadge inside KanbanCard
 *
 *  Fixes 2, 7 resolved in ClockContext / KanbanCard respectively.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  WifiOff, Wifi, AlertTriangle,
  Bell, X, Package, CheckCircle2,
  TrendingUp, ClipboardList, LayoutGrid, Volume2, VolumeX,
  Truck, RefreshCw, Search, MapPin, Clock, LogOut,
} from "lucide-react";
import { supabase }             from "@/lib/supabase";
import { useStaffOrders }       from "@/hooks/useStaffOrders";
import { useAudio }             from "@/hooks/useAudio";
import { useOnlineStatus }      from "@/hooks/useOnlineStatus";
import { useGuestCooldowns }    from "@/hooks/useGuestCooldowns";
import { useStaffZones }        from "@/hooks/useStaffZones";
import { useZoneRequests }      from "@/hooks/useZoneRequests";
import { KanbanColumn }         from "@/components/staff/KanbanColumn";
import { StatCard }             from "@/components/staff/StatCard";
import { StaffLogin }           from "@/components/staff/StaffLogin";
import { NotificationCenter }   from "@/components/staff/NotificationCenter";
import { ZonePicker }           from "@/components/staff/ZonePicker";
import { cn }                   from "@/lib/utils";
import { fetchActiveLocations, type StaffLocation } from "@/lib/locations";
import type { OrderStatus }     from "@/lib/types";

const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing", "ready"];

// How long a delivered order stays in the default (non-search) board view —
// a fresh login has no record of what staff already dealt with, so this is
// the only thing keeping the Delivered column from re-filling with the
// entire day's completed orders every time someone opens a new session.
const DEFAULT_DELIVERED_WINDOW_MIN = 20;

// ─── Mobile tab config ────────────────────────────────────────────────────────

type ColKey = "pending" | "accepted" | "ready" | "delivered";

const COL_TABS: { key: ColKey; label: string }[] = [
  { key: "pending",   label: "New"   },
  { key: "accepted",  label: "Prep"  },
  { key: "ready",     label: "Ready" },
  { key: "delivered", label: "Done"  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function fmtAvgWait(seconds: number): string {
  if (seconds === 0) return "—";
  if (seconds < 60)  return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${seconds % 60}s`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  // Fix 6 — Staff identity gate
  const [staffName,  setStaffName]  = useState<string | null>(null);
  // The time-of-day greeting shows for the first minute after login, then
  // settles down to just the name so the header isn't stuck saying "Good
  // Morning" for the rest of a multi-hour shift.
  const [showGreeting, setShowGreeting] = useState(true);
  useEffect(() => {
    if (!staffName) return;
    setShowGreeting(true);
    const id = setTimeout(() => setShowGreeting(false), 60_000);
    return () => clearTimeout(id);
  }, [staffName]);
  const [mobileCol,  setMobileCol]  = useState<ColKey>("pending");
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [zonePickerOpen, setZonePickerOpen] = useState(false);
  const [zoneToast, setZoneToast] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Delivered orders this staff member has explicitly cleared from the
  // board — purely a declutter step. The order itself is untouched in
  // Supabase, so it's still fully searchable by guest name within the
  // normal 24h window; this only hides it from the default Delivered view.
  // Stored in Supabase keyed by staff_name (not device-local), so it
  // follows the staff member across sign-out/sign-in and any device —
  // Evan's confirms stay hidden for Evan everywhere, independent of
  // whichever browser/device he's signed in on.
  const [dismissedDelivered, setDismissedDelivered] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!staffName) return;
    supabase
      .from("staff_dismissed_orders")
      .select("order_id")
      .eq("staff_name", staffName)
      .then(({ data }) => {
        if (data) setDismissedDelivered(new Set(data.map(r => r.order_id as string)));
      });
  }, [staffName]);

  const confirmDelivered = useCallback((id: string) => {
    if (!staffName) return;
    setDismissedDelivered(prev => new Set(prev).add(id));
    supabase
      .from("staff_dismissed_orders")
      .upsert({ staff_name: staffName, order_id: id }, { onConflict: "staff_name,order_id" })
      .then(({ error }) => {
        // Insert failed (e.g. offline) — undo the optimistic hide so the
        // card doesn't silently vanish from a confirm that didn't stick.
        if (error) setDismissedDelivered(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }, [staffName]);

  // Live (Supabase-backed) zone assignment — replaces the old static config
  // so an admin-approved switch takes effect immediately, no redeploy.
  const zones = useStaffZones();
  const zoneRequests = useZoneRequests(staffName ?? "Staff");

  // Hooks
  const {
    orders, allOrders, stats,
    loading, loadError,
    newOrderAlert, actionFeedback,
    notifications, unreadCount,
    acceptOrder, markReady, deliverOrder, cancelOrder,
    dismissAlert, markNotificationsRead,
    registerSyncCallback,
    refreshOrders,
  } = useStaffOrders(staffName ?? "Staff", zones.isVisible);

  // All active locations, for the zone picker — fetched once, doesn't need
  // to be realtime itself (locations rarely change mid-event).
  const [allLocations, setAllLocations] = useState<StaffLocation[]>([]);
  useEffect(() => { fetchActiveLocations().then(setAllLocations); }, []);

  // Live order-pressure count per zone, across ALL locations (not just this
  // staff member's), so the picker can show where help is actually needed.
  const orderCountByZone = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of allOrders) {
      if (!o.locationId || !ACTIVE_ORDER_STATUSES.includes(o.status)) continue;
      map.set(o.locationId, (map.get(o.locationId) ?? 0) + 1);
    }
    return map;
  }, [allOrders]);

  // Surface the admin's decision once, then auto-clear.
  useEffect(() => {
    if (!zoneRequests.latest || zoneRequests.latest.status === "pending") return;
    setZoneToast(
      zoneRequests.latest.status === "approved"
        ? "Your zone request was approved"
        : "Your zone request wasn't approved",
    );
    const id = setTimeout(() => { setZoneToast(null); zoneRequests.acknowledge(); }, 4000);
    return () => clearTimeout(id);
  }, [zoneRequests.latest, zoneRequests.acknowledge]);

  const handleZoneSubmit = (type: "switch" | "add", zoneId: string) => {
    zoneRequests.submitRequest(type, zoneId);
    setZonePickerOpen(false);
  };

  // Read-only context: the SAME server-enforced cooldown the guest app
  // shows and enforces — not a second cooldown concept. Fetched per unique
  // guest, refreshed occasionally; the live countdown itself rides the
  // shared ClockContext tick inside each KanbanCard.
  const cooldownGuestIds = useMemo(
    () => orders.map(o => o.guestId).filter((id): id is string => !!id),
    [orders],
  );
  const guestCooldowns = useGuestCooldowns(cooldownGuestIds);

  const audio   = useAudio();
  const conn    = useOnlineStatus();

  // Wire sync callback so connectivity status updates on every order change
  useEffect(() => {
    registerSyncCallback(() => conn.markSynced());
  }, [registerSyncCallback, conn]);

  // Fix 1 — Audio: play chimes for significant events
  const prevAlertId  = useRef<string | null>(null);
  const prevOverdue  = useRef(0);
  const prevDelivered= useRef(stats.totalDelivered);

  useEffect(() => {
    // New order chime
    if (newOrderAlert && newOrderAlert.id !== prevAlertId.current) {
      prevAlertId.current = newOrderAlert.id;
      audio.play("new-order");
    }
  }, [newOrderAlert, audio]);

  useEffect(() => {
    // Overdue alarm — only fires when overdueCount increases
    if (stats.overdueCount > prevOverdue.current) {
      audio.play("overdue");
    }
    prevOverdue.current = stats.overdueCount;
  }, [stats.overdueCount, audio]);

  useEffect(() => {
    // Delivered chime
    if (stats.totalDelivered > prevDelivered.current) {
      audio.play("delivered");
    }
    prevDelivered.current = stats.totalDelivered;
  }, [stats.totalDelivered, audio]);

  // ── Kanban columns — memoized ───────────────────────────────────────────
  const columns = useMemo(() => {
    const sort = (list: typeof orders) => [...list].sort((a, b) => {
      const overdueA = a.status === "pending" &&
        (Date.now() - new Date(a.placedAt).getTime()) / 60_000 >= 10;
      const overdueB = b.status === "pending" &&
        (Date.now() - new Date(b.placedAt).getTime()) / 60_000 >= 10;
      if (overdueA && !overdueB) return -1;
      if (!overdueA && overdueB)  return 1;
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority)  return 1;
      return new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
    });
    const q = guestSearch.trim().toLowerCase();
    // Search looks across every location, not just this staff member's
    // assigned zones — a guest's order should be findable by whichever
    // staff member they happen to walk up to. The normal (no-search) view
    // still only ever uses the zone-filtered `orders`.
    const source = q ? allOrders : orders;
    const matchesSearch = (o: typeof orders[number]) =>
      !q || (o.guestName ?? "").toLowerCase().includes(q);
    return {
      pending:   sort(source.filter(o => o.status === "pending" && matchesSearch(o))),
      accepted:  sort(source.filter(o => (o.status === "accepted" || o.status === "preparing") && matchesSearch(o))),
      ready:     sort(source.filter(o => o.status === "ready" && matchesSearch(o))),
      // Default view only shows orders delivered in the last 20 minutes —
      // a fresh login/new tab has no session state to know what's already
      // been dealt with, so without a time floor every order delivered
      // earlier that day would reappear and clutter the board. Manually
      // dismissed cards stay hidden sooner than that. Neither restriction
      // applies once searching — search still reaches the full 24h window.
      delivered: sort(source.filter(o => {
        if (o.status !== "delivered" || !matchesSearch(o)) return false;
        if (q) return true;
        if (dismissedDelivered.has(o.id)) return false;
        const deliveredMinutesAgo = (Date.now() - new Date(o.deliveredAt ?? o.placedAt).getTime()) / 60_000;
        return deliveredMinutesAgo <= DEFAULT_DELIVERED_WINDOW_MIN;
      })),
    };
  }, [orders, allOrders, guestSearch, dismissedDelivered]);

  // Orders visible only because of a cross-location search — flagged with
  // a "Not your zone" badge so staff know it's outside their normal queue.
  const crossZoneOrderIds = useMemo(() => {
    if (!guestSearch.trim()) return undefined;
    const ids = new Set<string>();
    for (const list of Object.values(columns)) {
      for (const o of list) {
        if (!zones.isVisible(o.locationId, staffName ?? "")) ids.add(o.id);
      }
    }
    return ids;
  }, [columns, guestSearch, staffName, zones.isVisible]);

  // ─────────────────────────────────────────────────────────────────────────

  // Fix 6 — block the dashboard until staff identifies themselves
  if (!staffName) {
    return <StaffLogin onLogin={setStaffName} />;
  }

  // Fix 9 — connectivity state visual
  const connColor =
    conn.state === "live"          ? "text-emerald-400 bg-emerald-500/8 border-emerald-500/15" :
    conn.state === "slow"          ? "text-amber-400 bg-amber-500/8 border-amber-500/15"       :
    conn.state === "reconnecting"  ? "text-orange-400 bg-orange-500/8 border-orange-500/15"    :
    "text-red-400 bg-red-500/8 border-red-500/20";

  const connLabel =
    conn.state === "live"         ? "Live"          :
    conn.state === "slow"         ? "Slow"          :
    conn.state === "reconnecting" ? "Reconnecting…" :
    "Offline";

  const emptyLabel = (base: string) =>
    guestSearch.trim() ? `No orders found for "${guestSearch.trim()}"` : base;

  // Shared column props
  const colProps = {
    onAccept:  acceptOrder,
    onReady:   markReady,
    onDeliver: deliverOrder,
    onCancel:  cancelOrder,
    onConfirmDelivered: confirmDelivered,
    feedback:  actionFeedback,
    newOrderId: newOrderAlert?.id ?? null,
    guestCooldowns,
    crossZoneOrderIds,
  };

  return (
    /*
     * Fix 8 — viewport fix:
     * h-screen + flex flex-col on the root, flex-1 + min-h-0 on the board.
     * No magic-number calc(100dvh - 240px) that breaks with different
     * header heights or soft keyboard states.
     */
    <div className="h-screen flex flex-col overflow-hidden bg-base">

      {/* Dot-grid atmosphere */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage:"radial-gradient(circle,rgba(30,46,66,0.6) 1px,transparent 1px)", backgroundSize:"32px 32px" }}
      />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(16,185,129,0.04),transparent)]" />

      {/* ── Fix 1 — New order toast ── */}
      {newOrderAlert && (
        <div className="fixed top-4 right-4 z-50 w-[310px] animate-alert-in">
          <div className="bg-surface border border-amber-400/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden">
            <div className="h-1 bg-amber-400 animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-amber-600 via-amber-200 to-amber-600" />
            <div className="p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-400/15 border border-amber-400/25 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse-ring">
                <Bell size={16} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-0.5">
                  ✦ New Order
                </p>
                <p className="text-white font-display font-bold text-sm leading-tight truncate">
                  {newOrderAlert.locationName}
                </p>
                <p className="text-slate-400 text-xs font-body mt-0.5 truncate">
                  {newOrderAlert.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                </p>
              </div>
              <button onClick={dismissAlert} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="relative z-30 flex-shrink-0 bg-base/96 backdrop-blur-xl border-b border-border">
        <div className="px-4 flex items-center justify-between gap-2" style={{ height: "52px" }}>

          {/* Brand + staff identity */}
          <div className="min-w-0">
            <p className="font-display font-bold text-base leading-none truncate bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              POUR
            </p>
            {/* Fix 6 — staffName shown in header */}
            <p className="text-[11px] font-body text-slate-300 mt-0.5 truncate">
              {showGreeting ? `${greeting()}, ${staffName}` : staffName}
            </p>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 flex-shrink-0">

            {/* Overdue badge */}
            {stats.overdueCount > 0 && (
              <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-1 animate-pulse-red">
                <AlertTriangle size={10} className="text-red-400" />
                <span className="text-[10px] font-mono text-red-400 font-bold">
                  {stats.overdueCount} late
                </span>
              </div>
            )}

            {/* Fix 9 — connectivity status */}
            <div className={cn(
              "hidden sm:flex items-center gap-1.5 rounded-full px-2 py-1 border text-[10px] font-mono",
              connColor,
            )}>
              <span className="relative flex h-1.5 w-1.5">
                {conn.state === "live" && (
                  <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={cn("relative h-1.5 w-1.5 rounded-full inline-flex",
                  conn.state === "live"          ? "bg-emerald-500" :
                  conn.state === "slow"          ? "bg-amber-400"   :
                  conn.state === "reconnecting"  ? "bg-orange-400"  :
                  "bg-red-500"
                )} />
              </span>
              {connLabel}
            </div>

            {/* Zones — request a switch/add, with a pending-request indicator */}
            <button
              onClick={() => setZonePickerOpen(true)}
              title="Request a zone change"
              className={cn(
                "relative w-8 h-8 rounded-xl flex items-center justify-center transition-all border",
                "bg-surface border-border text-slate-400 hover:text-white",
              )}
            >
              <MapPin size={13} />
              {zoneRequests.latest?.status === "pending" && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-base flex items-center justify-center">
                  <Clock size={6} className="text-void" />
                </span>
              )}
            </button>

            {/* Manual refresh — re-fetches orders from Supabase */}
            <button
              onClick={() => refreshOrders()}
              title="Refresh orders"
              disabled={loading}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all border",
                "bg-surface border-border text-slate-400 hover:text-white",
                loading && "opacity-60 cursor-wait",
              )}
            >
              <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            </button>

            {/* Fix 1 — audio toggle */}
            <button
              onClick={audio.toggle}
              title={audio.enabled ? "Mute notifications" : "Unmute notifications"}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all border",
                audio.enabled
                  ? "bg-surface border-border text-slate-400 hover:text-white"
                  : "bg-slate-500/10 border-slate-500/20 text-slate-600",
              )}
            >
              {audio.enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>

            {/* Fix 4 — notification bell */}
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              isOpen={notifOpen}
              onOpen={() => { setNotifOpen(true); markNotificationsRead(); }}
              onClose={() => setNotifOpen(false)}
              onMarkAllRead={markNotificationsRead}
            />

            {/* On/Off duty */}
            <button
              onClick={() => {}} // extend: would update server presence state
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
            >
              <Wifi size={11} />
              On Duty
            </button>

            <button
              onClick={() => setConfirmSignOut(true)}
              aria-label="Sign out"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all bg-raised border-border text-slate-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
            >
              <LogOut size={11} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

          </div>
        </div>
      </header>

      {/* ── Main content area — flex-1 fills remaining viewport ── */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col p-3 gap-3">

        {/* Load error banner */}
        {loadError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 flex-shrink-0">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-xs font-body text-red-300">
              Failed to load orders: {loadError}
            </span>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 flex-shrink-0">
          <StatCard
            label="Active"
            value={stats.totalActive}
            icon={ClipboardList}
            accent="gold"
            sub="Total in queue"
          />
          <StatCard
            label="New"
            value={stats.totalPending}
            icon={Bell}
            accent={stats.overdueCount > 0 ? "red" : "amber"}
            pulse={stats.overdueCount > 0}
            sub={stats.overdueCount > 0 ? `${stats.overdueCount} overdue` : "Needs action"}
            onClick={() => setMobileCol("pending")}
          />
          <StatCard
            label="Preparing"
            value={stats.totalAccepted}
            icon={Package}
            accent="blue"
            sub="Being made"
            onClick={() => setMobileCol("accepted")}
          />
          <StatCard
            label="Ready"
            value={stats.totalReady}
            icon={LayoutGrid}
            accent="violet"
            sub="Needs runner"
            onClick={() => setMobileCol("ready")}
          />
          <StatCard
            label="Delivered"
            value={stats.totalDelivered}
            icon={CheckCircle2}
            accent="emerald"
            sub="Today"
            onClick={() => setMobileCol("delivered")}
          />
          <StatCard
            label="Avg Wait"
            value={fmtAvgWait(stats.avgWaitSeconds)}
            icon={TrendingUp}
            accent="gold"
            sub="Per delivery"
          />
        </div>

        {/* ── Guest name search ── */}
        <div className="relative flex-shrink-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/70 pointer-events-none" />
          <input
            value={guestSearch}
            onChange={e => setGuestSearch(e.target.value)}
            placeholder="Search by guest name…"
            className="w-full bg-raised border border-gold-500/25 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 font-body focus:outline-none focus:border-gold-500/60 focus:bg-surface transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
          />
          {guestSearch && (
            <button
              onClick={() => setGuestSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* ── Mobile column tabs ── */}
        <div className="flex lg:hidden gap-1.5 flex-shrink-0 overflow-x-auto no-scrollbar">
          {COL_TABS.map(({ key, label }) => {
            const count =
              key === "pending"  ? columns.pending.length  :
              key === "accepted" ? columns.accepted.length :
              key === "ready"    ? columns.ready.length    :
              columns.delivered.length;
            const isActive = mobileCol === key;
            return (
              <button
                key={key}
                onClick={() => setMobileCol(key)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-body font-semibold",
                  "border transition-all active:scale-95",
                  isActive
                    ? key === "pending"  ? "bg-amber-400/10  border-amber-400/25  text-amber-300"
                    : key === "accepted" ? "bg-blue-400/10   border-blue-400/25   text-blue-300"
                    : key === "ready"    ? "bg-violet-400/10 border-violet-400/25 text-violet-300"
                    :                     "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    : "bg-surface border-border text-slate-400 hover:text-slate-200",
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    isActive ? "bg-white/15 text-current" : "bg-raised text-slate-500",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Kanban board — flex-1 + min-h-0 fills the remaining space (Fix 8) ── */}

        {/* Desktop — 4 columns */}
        <div className="hidden lg:flex gap-3 flex-1 min-h-0">
          <KanbanColumn title="New Orders" status="pending"
            orders={columns.pending}   count={columns.pending.length}
            accentColor="text-amber-400"   headerBg="bg-amber-400/5"
            emptyLabel={emptyLabel("No new orders waiting")}
            {...colProps} />
          <KanbanColumn title="Preparing" status="accepted"
            orders={columns.accepted}  count={columns.accepted.length}
            accentColor="text-blue-400"    headerBg="bg-blue-400/5"
            emptyLabel={emptyLabel("Nothing being prepared")}
            {...colProps} />
          <KanbanColumn title="Ready" status="ready"
            orders={columns.ready}     count={columns.ready.length}
            accentColor="text-violet-400"  headerBg="bg-violet-400/5"
            emptyLabel={emptyLabel("Nothing ready yet")}
            {...colProps} />
          <KanbanColumn title="Delivered" status="delivered"
            orders={columns.delivered} count={columns.delivered.length}
            accentColor="text-emerald-400" headerBg="bg-emerald-400/5"
            emptyLabel={emptyLabel("No deliveries yet today")}
            {...colProps} />
        </div>

        {/* Tablet — 2×2 grid */}
        <div className="hidden sm:grid lg:hidden grid-cols-2 gap-3 flex-1 min-h-0">
          <KanbanColumn title="New Orders" status="pending"
            orders={columns.pending}   count={columns.pending.length}
            accentColor="text-amber-400"   headerBg="bg-amber-400/5"
            emptyLabel={emptyLabel("No new orders")}
            {...colProps} />
          <KanbanColumn title="Preparing" status="accepted"
            orders={columns.accepted}  count={columns.accepted.length}
            accentColor="text-blue-400"    headerBg="bg-blue-400/5"
            emptyLabel={emptyLabel("Nothing being prepared")}
            {...colProps} />
          <KanbanColumn title="Ready" status="ready"
            orders={columns.ready}     count={columns.ready.length}
            accentColor="text-violet-400"  headerBg="bg-violet-400/5"
            emptyLabel={emptyLabel("Nothing ready yet")}
            {...colProps} />
          <KanbanColumn title="Delivered" status="delivered"
            orders={columns.delivered} count={columns.delivered.length}
            accentColor="text-emerald-400" headerBg="bg-emerald-400/5"
            emptyLabel={emptyLabel("No deliveries yet")}
            {...colProps} />
        </div>

        {/* Mobile — single active column */}
        <div className="flex sm:hidden flex-1 min-h-0">
          {mobileCol === "pending" && (
            <KanbanColumn title="New Orders" status="pending"
              orders={columns.pending} count={columns.pending.length}
              accentColor="text-amber-400" headerBg="bg-amber-400/5"
              emptyLabel={emptyLabel("No new orders")} isActive {...colProps} />
          )}
          {mobileCol === "accepted" && (
            <KanbanColumn title="Preparing" status="accepted"
              orders={columns.accepted} count={columns.accepted.length}
              accentColor="text-blue-400" headerBg="bg-blue-400/5"
              emptyLabel={emptyLabel("Nothing being prepared")} isActive {...colProps} />
          )}
          {mobileCol === "ready" && (
            <KanbanColumn title="Ready" status="ready"
              orders={columns.ready} count={columns.ready.length}
              accentColor="text-violet-400" headerBg="bg-violet-400/5"
              emptyLabel={emptyLabel("Nothing ready yet")} isActive {...colProps} />
          )}
          {mobileCol === "delivered" && (
            <KanbanColumn title="Delivered" status="delivered"
              orders={columns.delivered} count={columns.delivered.length}
              accentColor="text-emerald-400" headerBg="bg-emerald-400/5"
              emptyLabel={emptyLabel("No deliveries yet")} isActive {...colProps} />
          )}
        </div>

      </main>

      {/* ── Zone request result toast ── */}
      {zoneToast && (
        <div className="fixed bottom-4 inset-x-4 z-50 flex justify-center animate-fade-up">
          <div className={cn(
            "px-4 py-2.5 rounded-xl border text-sm font-body shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
            zoneToast.includes("approved")
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-surface border-border text-slate-200",
          )}>
            {zoneToast}
          </div>
        </div>
      )}

      {/* ── Zone picker sheet ── */}
      {zonePickerOpen && (
        <ZonePicker
          locations={allLocations}
          myZoneIds={zones.zonesFor(staffName)}
          orderCountByZone={orderCountByZone}
          pending={zoneRequests.latest}
          submitting={zoneRequests.submitting}
          onSubmit={handleZoneSubmit}
          onClose={() => setZonePickerOpen(false)}
        />
      )}

      {/* ── Sign-out confirmation ── */}
      {confirmSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setConfirmSignOut(false)}
          />
          <div className="relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-card overflow-hidden animate-scale-in">
            <div className="p-6">
              <h3 className="font-display text-lg font-semibold text-white mb-2">Sign out?</h3>
              <p className="text-slate-400 text-sm font-body leading-relaxed mb-6">
                You&apos;ll need to log in again to access the dashboard.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmSignOut(false)}
                  className="px-4 py-2 rounded-xl text-sm font-body font-semibold text-slate-300 bg-raised border border-border hover:bg-rim transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="px-4 py-2 rounded-xl text-sm font-body font-semibold bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-all"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
