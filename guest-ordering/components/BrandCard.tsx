"use client";

import { Clock } from "lucide-react";
import { cn, fmtUSD } from "@/lib/utils";
import { HOLIDAY_THEME_ACTIVE } from "@/lib/config";
import type { Beverage } from "@/lib/data";

interface BrandCardProps {
  brand:           string;
  emoji:           string;
  beverages:       Beverage[];
  cartQuantityMap: Map<string, number>;
  onClick:         (b: Beverage) => void;
  style?:          React.CSSProperties;
}

function flavorLabel(name: string, brand: string): string {
  return name.startsWith(brand + " ") ? name.slice(brand.length + 1) : name;
}

export function BrandCard({ brand, emoji, beverages, cartQuantityMap, onClick, style }: BrandCardProps) {
  const totalInCart = beverages.reduce((s, b) => s + (cartQuantityMap.get(b.id) ?? 0), 0);
  const price = beverages[0]?.price ?? 0;
  const prepMin = beverages[0]?.prepMinutes ?? 1;

  const cardBg = HOLIDAY_THEME_ACTIVE
    ? { background: "linear-gradient(145deg, #16266e 0%, #1d3384 32%, #341250 62%, #5e1418 100%)" }
    : undefined;

  return (
    <div
      style={{ ...style, ...cardBg }}
      className={cn(
        "group relative w-full rounded-2xl overflow-hidden animate-fade-up",
        HOLIDAY_THEME_ACTIVE
          ? "border border-blue-400/60 shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_20px_rgba(37,99,235,0.25)]"
          : "border border-edge bg-card shadow-card",
      )}
    >
      <div className="absolute inset-0 bg-card-sheen pointer-events-none" />

      {/* July 4th star pattern + red/blue top accent bar */}
      {HOLIDAY_THEME_ACTIVE && (
        <>
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-red-500 via-white/80 to-blue-500 pointer-events-none" />
        </>
      )}

      {/* Hero area */}
      <div className={cn(
        "relative h-28 flex items-center justify-center overflow-hidden",
        HOLIDAY_THEME_ACTIVE
          ? "bg-gradient-to-b from-blue-950/70 to-transparent"
          : "bg-gradient-to-b from-lift to-card",
      )}>
        {HOLIDAY_THEME_ACTIVE ? (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(220,38,38,0.2),transparent)]" />
        ) : (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(16,185,129,0.13),transparent)]" />
        )}

        <span className="text-5xl select-none">{emoji}</span>

        {totalInCart > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-felt-500/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-felt-glow">
            <span className="text-[10px] font-mono font-bold text-white">{totalInCart} in order</span>
          </div>
        )}

        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-void/70 backdrop-blur-sm rounded-full px-2 py-0.5">
          <Clock size={9} className="text-gold-400" />
          <span className="text-[9px] font-mono text-mist-200">{prepMin}m</span>
        </div>
      </div>

      {/* Brand name + flavor chips */}
      <div className="px-3.5 pt-3 pb-3">
        <h3 className={cn(
          "font-display font-bold text-xl leading-tight mb-2.5",
          HOLIDAY_THEME_ACTIVE
            ? "text-white drop-shadow-[0_1px_8px_rgba(96,165,250,0.5)]"
            : "text-white",
        )}>{brand}</h3>

        <p className={cn(
          "text-[10px] font-mono uppercase tracking-widest mb-2 font-semibold",
          HOLIDAY_THEME_ACTIVE ? "text-blue-200/80" : "text-mist-400",
        )}>Pick a flavor</p>
        <div className="flex flex-wrap gap-2">
          {beverages.map(bev => {
            const qty   = cartQuantityMap.get(bev.id) ?? 0;
            const label = flavorLabel(bev.name, brand);
            return (
              <button
                key={bev.id}
                onClick={() => onClick(bev)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-sm font-body font-bold transition-all active:scale-95",
                  qty > 0
                    ? "bg-felt-500/30 border-felt-400 text-felt-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                    : HOLIDAY_THEME_ACTIVE
                    ? "bg-white/5 border-white/25 text-white hover:border-white/50 hover:bg-white/10"
                    : "bg-lift border-edge text-mist-200 hover:border-rim hover:text-white",
                )}
              >
                {label}
                {qty > 0 && (
                  <span className="text-[10px] font-mono bg-felt-500/30 rounded-full px-1.5 py-0.5 text-felt-200">
                    {qty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className={cn(
        "flex items-center justify-between px-3.5 py-3 border-t",
        HOLIDAY_THEME_ACTIVE ? "border-blue-900/40" : "border-edge",
      )}>
        <div>
          <span className="font-mono font-bold text-lg text-white">{fmtUSD(price)}</span>
          <p className={cn(
            "text-[10px] font-mono",
            HOLIDAY_THEME_ACTIVE ? "text-blue-300/70" : "text-mist-400",
          )}>per drink</p>
        </div>
        <p className={cn(
          "text-[11px] font-body",
          HOLIDAY_THEME_ACTIVE ? "text-blue-200/80" : "text-mist-400",
        )}>Tap a flavor to order</p>
      </div>
    </div>
  );
}
