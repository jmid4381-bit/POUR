"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Wine, ClipboardList, Users,
  Zap, X, ChevronRight, Menu, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useStore } from "@/lib/store";
import { getCachedVenueBranding, setCachedVenueBranding } from "@/lib/currentVenue";

const DEFAULT_VENUE_NAME = "POUR";
const DEFAULT_ACCENT     = "#C9A030";

const NAV = [
  { href: "/admin/overview",  icon: LayoutDashboard, label: "Overview"      },
  { href: "/admin/beverages", icon: Wine,            label: "Beverages"     },
  { href: "/admin/orders",    icon: ClipboardList,   label: "Orders"        },
  { href: "/admin/staff",     icon: Users,           label: "Staff"         },
];

export function MobileNavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const { state, venueId, isPlatformAdmin, venues, chooseVenue } = useStore();
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
  // to the CSS var before the browser paints.
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
    <>
      {/* ── Compact top bar (mobile/tablet only) ── */}
      <header className="lg:hidden sticky top-0 z-30 bg-base/96 backdrop-blur-xl border-b border-edge">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--venue-accent, #C9A030)" }}
            >
              <Wine size={14} className="text-void" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-white text-sm leading-none">Admin Console</p>
              {/* Platform admins get the switcher right here -- burying it inside
                  the hamburger drawer meant an extra tap (and an extra round-trip
                  to find it) just to flip venues, every single time. */}
              {isPlatformAdmin && venues.length > 0 ? (
                <select
                  value={venueId ?? ""}
                  onChange={e => chooseVenue(e.target.value)}
                  className="text-[9px] font-mono text-gold-500/70 tracking-widest uppercase mt-0.5 bg-transparent focus:outline-none max-w-[140px]"
                >
                  {venues.map(v => (
                    <option key={v.id} value={v.id} className="bg-surface text-ink-200 normal-case tracking-normal">{v.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-[9px] font-mono text-gold-500/70 tracking-widest uppercase mt-0.5">{venueName}</p>
              )}
            </div>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 rounded-xl bg-surface border border-edge flex items-center justify-center text-ink-400 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={17} />
          </button>
        </div>

        {/* Bottom tab bar for quick access */}
        <div className="flex border-t border-edge/40 overflow-x-auto no-scrollbar">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            const badge  = NAV_BADGES[href] ?? 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex-1 flex flex-col items-center gap-0.5 py-2 px-2 text-center transition-colors min-w-0",
                  active ? "text-gold-400 border-b-2 border-gold-400/60 -mb-px" : "text-ink-400 hover:text-ink-200",
                )}
              >
                <span className="relative">
                  <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                  {badge > 0 && !active && (
                    <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
                  )}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-wide truncate w-full text-center">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* ── Slide-over navigation drawer ── */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-void/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar-surface border-r border-edge animate-slide-right shadow-[8px_0_48px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between px-5 py-5 border-b border-edge">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--venue-accent, #C9A030)" }}
                >
                  <Wine size={16} className="text-void" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-display font-semibold text-white text-base leading-none">Admin Console</p>
                  <p className="text-2xs font-mono text-gold-500/70 tracking-widest uppercase mt-0.5">{venueName}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {isPlatformAdmin && venues.length > 0 && (
              <div className="px-5 pt-4">
                <label className="text-2xs font-mono text-ink-400 uppercase tracking-widest mb-1.5 block">
                  Venue
                </label>
                <select
                  value={venueId ?? ""}
                  onChange={e => chooseVenue(e.target.value)}
                  className="w-full bg-raised border border-edge rounded-lg px-2.5 py-2 text-sm text-ink-200 font-body focus:outline-none focus:border-gold-500/40"
                >
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}

            <nav className="p-3 space-y-1">
              {NAV.map(({ href, icon: Icon, label }) => {
                const active = pathname.startsWith(href);
                const badge  = NAV_BADGES[href] ?? 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                      active
                        ? "bg-gold-500/10 border border-gold-500/20 text-white"
                        : "text-ink-400 hover:text-white hover:bg-raised",
                    )}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.5}
                      className={active ? "text-gold-400" : "text-ink-400"} />
                    <span className="text-sm font-body font-medium flex-1">{label}</span>
                    {badge > 0 && !active && (
                      <span className="text-[9px] font-mono font-semibold bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-1.5 leading-[15px]">
                        {badge}
                      </span>
                    )}
                    {active && <ChevronRight size={13} className="text-gold-500/60" />}
                  </Link>
                );
              })}
              <button
                onClick={() => setConfirmSignOut(true)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all w-full text-red-400 hover:bg-red-500/10"
              >
                <LogOut size={16} strokeWidth={1.5} />
                <span className="text-sm font-body font-medium flex-1 text-left">Sign Out</span>
              </button>
            </nav>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message="You'll need to log in again to access the admin console."
        confirmLabel="Sign Out"
        onConfirm={() => supabase.auth.signOut()}
        onCancel={() => setConfirmSignOut(false)}
      />
    </>
  );
}
