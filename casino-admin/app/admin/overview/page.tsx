"use client";

import {
  LayoutDashboard, DollarSign, ShoppingBag, Clock,
  CheckCircle2, AlertTriangle, TrendingUp, Users,
  Zap, Activity, Star, MapPin, ArrowRight,
} from "lucide-react";
import { useAnalytics }  from "@/hooks/useAnalytics";
import { MetricCard }    from "@/components/admin/MetricCard";
import { ZoneRequestsCard } from "@/components/admin/ZoneRequestsCard";
import { EventControlCard } from "@/components/admin/EventControlCard";
import { VenueSettingsCard } from "@/components/admin/VenueSettingsCard";
import { useStore }      from "@/lib/store";
import { cn, fmtUSD, fmtDateTime } from "@/lib/utils";
import { STATUS_META, CATEGORY_META } from "@/lib/types";

// ─── Inline bar chart (no external library) ───────────────────────────────────

function BarChart({ data, maxVal }: { data: { label:string; revenue:number; orders:number }[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-2 h-28 mt-2">
      {data.map((d, i) => {
        const pct = maxVal > 0 ? (d.revenue / maxVal) * 100 : 0;
        const isToday = d.label === "Today";
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip on hover */}
            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
              <div className="bg-raised border border-edge rounded-lg px-2 py-1.5 text-center shadow-modal whitespace-nowrap">
                <p className="text-white font-mono text-xs font-bold">{fmtUSD(d.revenue)}</p>
                <p className="text-ink-400 font-mono text-[10px]">{d.orders} orders</p>
              </div>
              <div className="w-2 h-2 bg-raised border-r border-b border-edge rotate-45 -mt-1" />
            </div>
            <div
              className={cn(
                "w-full rounded-t-lg transition-all duration-700 min-h-[4px]",
                isToday ? "bg-gold-gradient" : "bg-ink-600/60 group-hover:bg-ink-500/80",
              )}
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
            <span className={cn(
              "text-[9px] font-mono whitespace-nowrap",
              isToday ? "text-gold-400" : "text-ink-400",
            )}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity feed event ──────────────────────────────────────────────────────

function ActivityRow({ order, index }: { order: ReturnType<typeof useAnalytics>["recentActivity"][number]; index: number }) {
  const meta = STATUS_META[order.status];
  const isActive = ["pending","accepted","preparing"].includes(order.status);
  const ageMin = Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 60_000);

  return (
    <div
      className="flex items-center gap-3 py-2.5 border-b border-edge/40 last:border-0 animate-row-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Status dot */}
      <div className="relative flex-shrink-0">
        <div className={cn("w-2 h-2 rounded-full", meta.dot)} />
        {isActive && (
          <div className={cn("absolute inset-0 rounded-full animate-ping-gold opacity-60", meta.dot)} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-body font-medium truncate leading-tight">
          {order.locationName}
          {order.guestName && (
            <span className="text-gold-400/80 font-mono font-normal"> · {order.guestName}</span>
          )}
        </p>
        <p className="text-ink-400 text-2xs font-mono">
          {order.items.map(i => `${i.quantity}× ${i.beverageName}`).join(", ").substring(0,40)}…
        </p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span className={cn("text-2xs font-mono font-semibold px-1.5 py-0.5 rounded-full border", meta.color)}>
          {meta.label}
        </span>
        <span className="text-2xs font-mono text-ink-400 mt-0.5">
          {ageMin < 1 ? "just now" : ageMin < 60 ? `${ageMin}m ago` : ageMin < 1440 ? `${Math.floor(ageMin/60)}h ago` : (() => { const d = Math.floor(ageMin/1440); const h = Math.floor((ageMin % 1440)/60); return h > 0 ? `${d}d ${h}h ago` : `${d}d ago`; })()}
        </span>
      </div>
    </div>
  );
}

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({ alert, index }: { alert: ReturnType<typeof useAnalytics>["alerts"][number]; index: number }) {
  const colors: Record<string, string> = {
    critical: "border-red-500/30 bg-red-500/5 text-red-400",
    high:     "border-amber-500/30 bg-amber-500/5 text-amber-400",
    medium:   "border-blue-500/25 bg-blue-500/5 text-blue-400",
    low:      "border-ink-500/20 bg-raised text-ink-400",
  };
  const icons: Record<string, React.ElementType> = {
    overdue:   AlertTriangle,
    priority:  Star,
    cancelled: ShoppingBag,
    system:    Activity,
  };
  const Icon = icons[alert.type] ?? AlertTriangle;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 p-3 rounded-xl border text-xs font-body animate-row-in",
        colors[alert.severity],
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <Icon size={13} className="flex-shrink-0 mt-0.5" />
      <p className="leading-snug">{alert.message}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const a = useAnalytics();
  const { loading, error } = useStore();
  const maxDayRevenue = Math.max(...a.revenueByDay.map(d => d.revenue), 1);
  const maxItemRevenue = Math.max(...a.topItems.map(i => i.revenue), 1);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-ink-400 font-mono text-sm animate-pulse">Loading live data…</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-base/96 backdrop-blur-xl border-b border-edge px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard size={18} className="text-gold-400" />
            <div>
              <h1 className="font-display text-2xl font-semibold text-white">Operations Overview</h1>
              <p className="text-xs text-ink-400 font-mono mt-0.5">{dateStr} · {timeStr}</p>
            </div>
          </div>
          {/* Live indicator */}
          <div className={cn(
            "flex items-center gap-1.5 border rounded-full px-2.5 py-1",
            error ? "bg-red-400/8 border-red-400/15" : "bg-felt-400/8 border-felt-400/15",
          )}>
            <span className="relative flex h-1.5 w-1.5">
              {!error && <span className="animate-ping absolute h-full w-full rounded-full bg-felt-400 opacity-60" />}
              <span className={cn("relative h-1.5 w-1.5 rounded-full inline-flex", error ? "bg-red-500" : "bg-felt-500")} />
            </span>
            <span className={cn("text-2xs font-mono uppercase tracking-wider", error ? "text-red-400" : "text-felt-400")}>
              {error ? "Connection Error" : "Live"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Connection error banner ── */}
      {error && (
        <div className="mx-6 mt-5 flex items-center gap-3 bg-amber-500/8 border border-amber-500/25 rounded-2xl px-4 py-3 animate-fade-up">
          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
          <p className="text-amber-400/90 text-xs font-body">
            Could not reach Supabase: {error}. Data may be stale — refresh to retry.
          </p>
        </div>
      )}

      {/* ── Critical alert banner (impossible to miss) ── */}
      {a.overdueCount > 0 && (
        <div className="mx-6 mt-5 flex items-center gap-3 bg-red-500/8 border border-red-500/25 rounded-2xl px-4 py-3 animate-fade-up">
          <div className="w-8 h-8 bg-red-500/15 border border-red-500/25 rounded-xl flex items-center justify-center flex-shrink-0 animate-ping-gold">
            <AlertTriangle size={15} className="text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-body font-semibold text-sm">
              {a.overdueCount} order{a.overdueCount !== 1 ? "s" : ""} waiting over 10 minutes
            </p>
            <p className="text-red-400/80 text-xs font-body mt-0.5">
              {a.overdueOrders.map(o => o.locationName).join(" · ")}
            </p>
          </div>
          <span className="text-2xs font-mono text-red-400 uppercase tracking-wider">Action Required</span>
        </div>
      )}

      <div className="p-6 space-y-6">

        {/* ── VENUE BRANDING (multi-tenant) ── */}
        <VenueSettingsCard />

        {/* ── 4TH OF JULY EVENT CONTROL ── */}
        <EventControlCard />

        {/* ── ZONE REQUESTS ── */}
        <ZoneRequestsCard />

        {/* ── EXECUTIVE KPIs ── */}
        <div>
          <p className="text-2xs font-mono text-ink-400 uppercase tracking-widest mb-3">Executive Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricCard
              label="Active Orders"
              value={a.activeOrderCount}
              sub={`${a.pendingCount} pending · ${a.preparingCount} preparing`}
              icon={Activity}
              accent={a.activeOrderCount > 0 ? "amber" : "slate"}
              alert={a.overdueCount > 0}
              href="/admin/orders"
            />
            <MetricCard
              label="Today's Revenue"
              value={fmtUSD(a.todayRevenue)}
              sub={`${a.deliveredToday} orders delivered`}
              icon={DollarSign}
              accent="gold"
              href="/admin/orders"
            />
            <MetricCard
              label="Orders Today"
              value={a.todayOrderCount}
              sub={`${a.cancelledToday} cancelled`}
              icon={ShoppingBag}
              accent="felt"
              href="/admin/orders"
            />
            <MetricCard
              label="Avg Wait"
              value={a.avgWaitMinutes ? `${a.avgWaitMinutes}m` : "—"}
              sub="Delivered orders today"
              icon={Clock}
              accent="blue"
              href="/admin/orders"
            />
            <MetricCard
              label="Delivered"
              value={a.deliveredToday}
              sub="Completed today"
              icon={CheckCircle2}
              accent="felt"
              href="/admin/orders"
            />
            <MetricCard
              label="Alerts"
              value={a.criticalAlertCount}
              sub={a.criticalAlertCount > 0 ? "Needs attention" : "All clear"}
              icon={AlertTriangle}
              accent={a.criticalAlertCount > 0 ? "red" : "slate"}
              alert={a.criticalAlertCount > 0}
              onClick={() => document.getElementById("alert-centre")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
          </div>
        </div>

        {/* ── OPERATIONS PIPELINE ── */}
        <div>
          <p className="text-2xs font-mono text-ink-400 uppercase tracking-widest mb-3">Operations Pipeline</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label:"New Orders", count:a.pendingCount,   color:"text-amber-400",  bg:"bg-amber-400/8 border-amber-400/20",  dot:"bg-amber-400"  },
              { label:"Preparing",  count:a.preparingCount, color:"text-violet-400", bg:"bg-violet-400/8 border-violet-400/20",dot:"bg-violet-400" },
              { label:"Ready",      count:a.readyCount,     color:"text-sky-400",    bg:"bg-sky-400/8 border-sky-400/20",     dot:"bg-sky-400"    },
              { label:"Delivered",  count:a.deliveredToday, color:"text-felt-400",   bg:"bg-felt-400/8 border-felt-400/20",   dot:"bg-felt-400"   },
              { label:"Cancelled",  count:a.cancelledToday, color:"text-ink-400",    bg:"bg-ink-400/8 border-ink-400/20",    dot:"bg-ink-400"    },
            ].map(({ label, count, color, bg, dot }) => (
              <div key={label} className={cn("rounded-2xl border p-4", bg)}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-2 h-2 rounded-full", dot, count > 0 && label !== "Cancelled" && "animate-ping-gold")} />
                  <p className="text-2xs font-mono text-ink-400 uppercase tracking-wider">{label}</p>
                </div>
                <p className={cn("font-mono font-bold text-3xl", color)}>{count}</p>
                <p className="text-ink-400 text-2xs font-mono mt-1">
                  {label === "New Orders" && (count > 0 ? "Awaiting staff action" : "Queue clear")}
                  {label === "Preparing"  && (count > 0 ? "In progress" : "Nothing in progress")}
                  {label === "Ready"      && (count > 0 ? "Awaiting delivery" : "Nothing waiting")}
                  {label === "Delivered"  && "Completed today"}
                  {label === "Cancelled"  && (count > 0 ? "Review with floor" : "No cancellations")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACTIVITY FEED + ALERTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Activity feed */}
          <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-felt-400" />
                <h2 className="font-display font-semibold text-white text-base">Live Activity</h2>
              </div>
              <span className="text-2xs font-mono text-ink-400">Recent {a.recentActivity.length} events</span>
            </div>
            <div className="px-5 py-3 max-h-80 overflow-y-auto">
              {a.recentActivity.length > 0 ? (
                a.recentActivity.map((order, i) => (
                  <ActivityRow key={order.id} order={order} index={i} />
                ))
              ) : (
                <div className="py-10 text-center">
                  <Activity size={24} className="text-ink-700 mx-auto mb-2" />
                  <p className="text-ink-400 text-sm font-body">No activity yet today</p>
                </div>
              )}
            </div>
          </div>

          {/* Alert centre */}
          <div id="alert-centre" className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card scroll-mt-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className={a.criticalAlertCount > 0 ? "text-red-400" : "text-ink-400"} />
                <h2 className="font-display font-semibold text-white text-base">Alert Centre</h2>
                {a.criticalAlertCount > 0 && (
                  <span className="text-2xs font-mono bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-1.5 py-0.5">
                    {a.criticalAlertCount} active
                  </span>
                )}
              </div>
            </div>
            <div className="px-5 py-3 space-y-2 max-h-80 overflow-y-auto">
              {a.alerts.length > 0 ? (
                a.alerts.map((alert, i) => (
                  <AlertRow key={alert.id} alert={alert} index={i} />
                ))
              ) : (
                <div className="py-10 text-center">
                  <CheckCircle2 size={24} className="text-felt-500/60 mx-auto mb-2" />
                  <p className="text-felt-400/70 text-sm font-body">All systems normal</p>
                  <p className="text-ink-400 text-xs font-body mt-0.5">No alerts at this time</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── REVENUE + TOP ITEMS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 7-day revenue chart */}
          <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-gold-400" />
                <h2 className="font-display font-semibold text-white text-base">7-Day Revenue</h2>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-gold-300 text-lg leading-none">{fmtUSD(a.weekRevenue)}</p>
                <p className="text-2xs font-mono text-ink-400 mt-0.5">This week</p>
              </div>
            </div>
            <div className="px-5 pb-5 pt-3">
              <BarChart data={a.revenueByDay} maxVal={maxDayRevenue} />
              {/* Sub-metrics */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-edge/60">
                {[
                  { label: "Month", value: fmtUSD(a.monthRevenue)     },
                  { label: "Week",  value: fmtUSD(a.weekRevenue)      },
                  { label: "Avg Order", value: fmtUSD(a.avgOrderValue)},
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="font-mono font-bold text-gold-300 text-sm">{value}</p>
                    <p className="text-2xs font-mono text-ink-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top items */}
          <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2">
                <Star size={15} className="text-gold-400" />
                <h2 className="font-display font-semibold text-white text-base">Top Selling Items</h2>
              </div>
              <span className="text-2xs font-mono text-ink-400">By revenue</span>
            </div>
            <div className="px-5 py-3 space-y-2">
              {a.topItems.length > 0 ? a.topItems.slice(0,6).map((item, i) => {
                const pct = maxItemRevenue > 0 ? (item.revenue / maxItemRevenue) * 100 : 0;
                return (
                  <div key={item.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base flex-shrink-0">{item.emoji}</span>
                        <span className="text-sm text-white font-body truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-2xs font-mono text-ink-400">{item.count}×</span>
                        <span className="font-mono text-gold-300 text-sm font-semibold">{fmtUSD(item.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-edge rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", i === 0 ? "bg-gold-gradient" : "bg-ink-500/60")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              }) : (
                <p className="text-ink-400 text-sm font-body py-6 text-center">No order data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* ── STAFF PERFORMANCE ── */}
        {a.staffPerformance.length > 0 && (
          <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-felt-400" />
                <h2 className="font-display font-semibold text-white text-base">Staff Performance</h2>
              </div>
              <a href="/admin/staff" className="flex items-center gap-1 text-[11px] font-mono text-ink-400 hover:text-gold-400 transition-colors">
                View full report <ArrowRight size={11} />
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edge bg-raised/30">
                    {["Staff Member", "Orders", "Revenue", "Avg Delivery", "Status"].map((h, i) => (
                      <th key={h} className={cn("px-5 py-3 text-2xs font-mono text-ink-400 uppercase tracking-widest text-left", i >= 2 && "hidden sm:table-cell")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.staffPerformance.map((staff, i) => (
                    <tr key={staff.name} className="border-b border-edge/40 last:border-0 hover:bg-raised/30 transition-colors animate-row-in" style={{ animationDelay: `${i*30}ms` }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-gold-gradient rounded-full flex items-center justify-center text-void text-xs font-bold flex-shrink-0">
                            {staff.name.charAt(0)}
                          </div>
                          <span className="text-white font-body text-sm font-medium">{staff.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-white font-semibold">{staff.orders}</span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className={cn("font-mono font-semibold text-sm", staff.revenue >= 500 ? "text-gold-300" : "text-white")}>
                          {fmtUSD(staff.revenue)}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="font-mono text-blue-400 text-sm">{staff.avgWait}m</span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-2xs font-mono px-2 py-0.5 rounded-full border text-felt-400 bg-felt-400/10 border-felt-400/20">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LOCATION ACTIVITY ── */}
        <div>
          <p className="text-2xs font-mono text-ink-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MapPin size={12} />Location Activity
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {a.sectionActivity.slice(0,4).map((sec, i) => (
              <div key={sec.section} className={cn(
                "rounded-2xl border p-4 bg-surface shadow-card",
                sec.activeNow > 0 ? "border-gold-500/20" : "border-edge",
              )}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-white font-body font-medium text-sm leading-tight">{sec.section}</p>
                    <p className="text-ink-400 text-2xs font-mono mt-0.5">Floor {sec.floor}</p>
                  </div>
                  {sec.activeNow > 0 && (
                    <span className="text-2xs font-mono bg-amber-400/15 text-amber-400 border border-amber-400/20 rounded-full px-1.5 py-0.5 flex-shrink-0">
                      {sec.activeNow} active
                    </span>
                  )}
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="font-mono font-bold text-xl text-white leading-none">{sec.orders}</p>
                    <p className="text-[9px] font-mono text-ink-400 mt-0.5 uppercase tracking-wide">Orders</p>
                  </div>
                  <div>
                    <p className="font-mono font-bold text-xl text-gold-300 leading-none">{fmtUSD(sec.revenue)}</p>
                    <p className="text-[9px] font-mono text-ink-400 mt-0.5 uppercase tracking-wide">Revenue</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-4" />
      </div>
    </>
  );
}
