"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Wine, ClipboardList, Users,
  Zap, ChevronRight, Activity, AlertTriangle, LogOut,
} from "lucide-react";
import { cn, fmtUSD } from "@/lib/utils";
import { useAnalytics } from "@/hooks/useAnalytics";
import { supabase } from "@/lib/supabase";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useStore } from "@/lib/store";
import { getCachedVenueBranding, setCachedVenueBranding } from "@/lib/currentVenue";

const DEFAULT_VENUE_NAME  = "POUR";
const DEFAULT_ACCENT      = "#C9A030";

const NAV = [
  { href: "/admin/overview",  icon: LayoutDashboard, label: "Overview",       sub: "Executive dashboard"   },
  { href: "/admin/beverages", icon: Wine,            label: "Beverages",       sub: "Menu management"       },
  { href: "/admin/orders",    icon: ClipboardList,   label: "Order History",   sub: "Revenue & analytics"   },
  { href: "/admin/staff",     icon: Users,           label: "Staff",           sub: "Performance tracking"  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const a = useAnalytics();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const { state, venueId, isPlatformAdmin, venues, chooseVenue } = useStore();
  // Both of these live inside their own page's card (ZoneRequestsCard /
  // Beverages' Off Menu stat) and were invisible from anywhere else --
  // an admin on Staff or Orders had no way to know either needed attention.
  const pendingZoneRequests = state.zoneRequests.filter(r => r.status === "pending").length;
  const offMenuCount        = state.beverages.filter(b => !b.isAvailable).length;
  const NAV_BADGES: Record<string, number> = {
    "/admin/overview":  pendingZoneRequests,
    "/admin/beverages": offMenuCount,
  };
  // Lazy initializer -- runs synchronously on the very first render, so a
  // refresh paints the LAST REAL venue seen (cached from a prior successful
  // fetch) instead of the hardcoded "POUR" default while session/venueId/
  // the actual Supabase fetch are all still resolving asynchronously.
  const [venueName, setVenueName] = useState(() => getCachedVenueBranding()?.name ?? DEFAULT_VENUE_NAME);

  // useLayoutEffect (not useEffect) so the cached accent color is applied
  // to the CSS var before the browser paints, not after -- otherwise the
  // logo swatch's `var(--venue-accent, #C9A030)` fallback would flash gold
  // for one frame even though we already know the real cached color.
  useLayoutEffect(() => {
    const cached = getCachedVenueBranding();
    if (cached) document.documentElement.style.setProperty("--venue-accent", cached.accentColor);
  }, []);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    supabase.from("venues").select("name, accent_color").eq("id", venueId).maybeSingle().then(({ data }) => {
      // Venue switched again before this resolved -- don't apply a stale
      // venue's name/color over whichever one is being viewed now.
      if (cancelled || !data) return;
      const name   = (data.name ?? "").trim() || DEFAULT_VENUE_NAME;
      const accent = data.accent_color || DEFAULT_ACCENT;
      setVenueName(name);
      document.documentElement.style.setProperty("--venue-accent", accent);
      setCachedVenueBranding({ venueId, name, accentColor: accent });
    });
    return () => { cancelled = true; };
  }, [venueId]);

  return (
    <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-sidebar-surface border-r border-edge min-h-screen shadow-[1px_0_0_rgba(255,255,255,0.03)]">

      {/* Logo */}
      <div className="px-5 py-6 border-b border-edge">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-gold-sm flex-shrink-0"
            style={{ background: "var(--venue-accent, #C9A030)" }}
          >
            <Wine size={18} className="text-void" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display font-semibold text-white text-base leading-none">Admin Console</p>
            <p className="text-2xs font-mono text-gold-500/70 tracking-widest uppercase mt-0.5">{venueName}</p>
          </div>
        </div>
        {isPlatformAdmin && venues.length > 0 && (
          <select
            value={venueId ?? ""}
            onChange={e => chooseVenue(e.target.value)}
            className="mt-3 w-full bg-raised border border-edge rounded-lg px-2.5 py-1.5 text-xs text-ink-300 font-body focus:outline-none focus:border-gold-500/40"
          >
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Live operational metrics */}
      <div className="px-4 py-4 border-b border-edge">
        <p className="text-2xs font-mono text-ink-400 uppercase tracking-widest px-1 mb-3">Live Status</p>

        {/* Alert strip if overdue orders */}
        {a.overdueCount > 0 && (
          <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2 mb-2">
            <AlertTriangle size={12} className="text-red-400 flex-shrink-0 animate-ping-gold" />
            <p className="text-red-400 text-xs font-mono font-semibold">
              {a.overdueCount} overdue
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Active",   value: a.activeOrderCount,       color: a.activeOrderCount > 0 ? "text-amber-400" : "text-ink-400" },
            { label: "Today Rev",value: fmtUSD(a.todayRevenue),   color: "text-gold-400"    },
            { label: "Pending",  value: a.pendingCount,           color: a.pendingCount > 0  ? "text-amber-400" : "text-ink-400" },
            { label: "Avg Wait", value: a.avgWaitMinutes ? `${a.avgWaitMinutes}m` : "—", color: "text-blue-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-raised/50 border border-edge rounded-xl p-2.5">
              <p className={cn("font-mono font-bold text-base leading-none", color)}>{value}</p>
              <p className="text-[9px] font-mono text-ink-400 uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, sub }) => {
          const active = pathname.startsWith(href);
          const badge  = NAV_BADGES[href] ?? 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                active
                  ? "bg-gold-500/10 border border-gold-500/20"
                  : "border border-transparent text-ink-400 hover:text-white hover:bg-raised/70",
              )}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2 : 1.5}
                className={active ? "text-gold-400" : "text-ink-400 group-hover:text-ink-200"}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn("text-sm font-body font-medium leading-none", active ? "text-white" : "text-ink-300")}>
                    {label}
                  </p>
                  {badge > 0 && !active && (
                    <span className="text-[9px] font-mono font-semibold bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-1.5 leading-[15px]">
                      {badge}
                    </span>
                  )}
                </div>
                <p className={cn("text-2xs font-mono mt-0.5 truncate", active ? "text-gold-500/70" : "text-ink-400")}>
                  {sub}
                </p>
              </div>
              {active && <ChevronRight size={12} className="text-gold-500/60 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Live indicator + footer */}
      <div className="p-4 border-t border-edge space-y-3">
        <div className="flex items-center gap-2 px-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-felt-400 opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-felt-500 inline-flex" />
          </span>
          <span className="text-2xs font-mono text-felt-400 uppercase tracking-wider">System Online</span>
          <Activity size={10} className="text-felt-500/60 ml-auto" />
        </div>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-raised/50 transition-colors">
          <div className="w-8 h-8 bg-gold-gradient rounded-full flex items-center justify-center text-void font-bold text-xs flex-shrink-0">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-body font-medium leading-none">Administrator</p>
            <p className="text-2xs font-mono text-ink-400 mt-0.5">Full access</p>
          </div>
          <button
            onClick={() => setConfirmSignOut(true)}
            aria-label="Sign out"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message="You'll need to log in again to access the admin console."
        confirmLabel="Sign Out"
        onConfirm={() => supabase.auth.signOut()}
        onCancel={() => setConfirmSignOut(false)}
      />
    </aside>
  );
}
