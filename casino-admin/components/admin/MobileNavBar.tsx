"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Wine, ClipboardList, Users,
  Zap, X, ChevronRight, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/overview",  icon: LayoutDashboard, label: "Overview"      },
  { href: "/admin/beverages", icon: Wine,            label: "Beverages"     },
  { href: "/admin/orders",    icon: ClipboardList,   label: "Orders"        },
  { href: "/admin/staff",     icon: Users,           label: "Staff"         },
];

export function MobileNavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Compact top bar (mobile/tablet only) ── */}
      <header className="lg:hidden sticky top-0 z-30 bg-base/96 backdrop-blur-xl border-b border-edge">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gold-gradient rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-void" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display font-semibold text-white text-sm leading-none">Admin Console</p>
              <p className="text-[9px] font-mono text-gold-500/70 tracking-widest uppercase mt-0.5">The Grand Casino</p>
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
                <div className="w-9 h-9 bg-gold-gradient rounded-xl flex items-center justify-center">
                  <Zap size={16} className="text-void" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="font-display font-semibold text-white text-base leading-none">Admin Console</p>
                  <p className="text-[10px] font-mono text-gold-500/70 tracking-widest uppercase mt-0.5">The Grand Casino</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

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
            </nav>
          </div>
        </>
      )}
    </>
  );
}
