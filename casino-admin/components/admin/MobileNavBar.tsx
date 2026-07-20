"use client";

import { useState, useEffect } from "react";
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

const DEFAULT_VENUE_NAME = "POUR";

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
  const { venueId, isPlatformAdmin, venues, chooseVenue } = useStore();
  const [venueName, setVenueName] = useState(DEFAULT_VENUE_NAME);

  useEffect(() => {
    if (!venueId) return;
    let cancelled = false;
    supabase.from("venues").select("name, accent_color").eq("id", venueId).maybeSingle().then(({ data }) => {
      // Venue switched again before this resolved -- don't apply a stale
      // venue's name/color over whichever one is being viewed now.
      if (cancelled || !data) return;
      setVenueName((data.name ?? "").trim() || DEFAULT_VENUE_NAME);
      if (data.accent_color) document.documentElement.style.setProperty("--venue-accent", data.accent_color);
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
            <div>
              <p className="font-display font-semibold text-white text-sm leading-none">Admin Console</p>
              <p className="text-[9px] font-mono text-gold-500/70 tracking-widest uppercase mt-0.5">{venueName}</p>
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
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 px-2 text-center transition-colors min-w-0",
                  active ? "text-gold-400 border-b-2 border-gold-400/60 -mb-px" : "text-ink-500 hover:text-ink-200",
                )}
              >
                <Icon size={16} strokeWidth={active ? 2 : 1.5} />
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
                  <p className="text-[10px] font-mono text-gold-500/70 tracking-widest uppercase mt-0.5">{venueName}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {isPlatformAdmin && venues.length > 0 && (
              <div className="px-5 pt-4">
                <label className="text-[10px] font-mono text-ink-500 uppercase tracking-widest mb-1.5 block">
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
