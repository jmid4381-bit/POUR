"use client";

import { Clock } from "lucide-react";
import { cn, fmtUSD } from "@/lib/utils";
import type { Beverage } from "@/lib/data";

interface BrandCardProps {
  brand:           string;
  emoji:           string;
  beverages:       Beverage[];
  cartQuantityMap: Map<string, number>;
  onClick:         (b: Beverage) => void;
  style?:          React.CSSProperties;
}

// Extracts the flavor label by stripping the brand prefix from the name.
// "White Claw Mango" with brand "White Claw" → "Mango"
function flavorLabel(name: string, brand: string): string {
  return name.startsWith(brand + " ") ? name.slice(brand.length + 1) : name;
}

export function BrandCard({ brand, emoji, beverages, cartQuantityMap, onClick, style }: BrandCardProps) {
  const totalInCart = beverages.reduce((s, b) => s + (cartQuantityMap.get(b.id) ?? 0), 0);
  const price = beverages[0]?.price ?? 0;
  const prepMin = beverages[0]?.prepMinutes ?? 1;

  return (
    <div
      style={style}
      className="group relative w-full rounded-2xl overflow-hidden border border-edge bg-card shadow-card animate-fade-up"
    >
      <div className="absolute inset-0 bg-card-sheen pointer-events-none" />

      {/* Hero area */}
      <div className="relative h-28 flex items-center justify-center overflow-hidden bg-gradient-to-b from-lift to-card">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(16,185,129,0.13),transparent)]" />

        <span className="text-5xl select-none">{emoji}</span>

        {/* In-cart badge */}
        {totalInCart > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-felt-500/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-felt-glow">
            <span className="text-[10px] font-mono font-bold text-white">{totalInCart} in order</span>
          </div>
        )}

        {/* Prep badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-void/70 backdrop-blur-sm rounded-full px-2 py-0.5">
          <Clock size={9} className="text-gold-400" />
          <span className="text-[9px] font-mono text-mist-200">{prepMin}m</span>
        </div>
      </div>

      {/* Brand name + flavor chips */}
      <div className="px-3.5 pt-3 pb-3">
        <h3 className="font-display font-semibold text-lg leading-tight text-white mb-2.5">{brand}</h3>

        <p className="text-[10px] font-mono text-mist-500 uppercase tracking-widest mb-2">Pick a flavor</p>
        <div className="flex flex-wrap gap-2">
          {beverages.map(bev => {
            const qty   = cartQuantityMap.get(bev.id) ?? 0;
            const label = flavorLabel(bev.name, brand);
            return (
              <button
                key={bev.id}
                onClick={() => onClick(bev)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-body font-semibold transition-all active:scale-95",
                  qty > 0
                    ? "bg-felt-600/20 border-felt-500/40 text-felt-300"
                    : "bg-lift border-edge text-mist-200 hover:border-rim hover:text-white",
                )}
              >
                {label}
                {qty > 0 && (
                  <span className="text-[10px] font-mono bg-felt-500/30 rounded-full px-1.5 py-0.5 text-felt-300">
                    {qty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-3.5 py-3 border-t border-edge">
        <div>
          <span className="font-mono font-bold text-base text-white">{fmtUSD(price)}</span>
          <p className="text-[10px] text-mist-600 font-mono">per drink</p>
        </div>
        <p className="text-[11px] text-mist-500 font-body">Tap a flavor to order</p>
      </div>
    </div>
  );
}
