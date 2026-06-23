"use client";

import { useState } from "react";
import { Clock, Star, Plus, Check, Info } from "lucide-react";
import { cn, fmtUSD } from "@/lib/utils";
import { BeverageImage } from "./BeverageImage";
import type { Beverage } from "@/lib/data";

interface BeverageCardProps {
  beverage:      Beverage;
  onClick:       (b: Beverage) => void;
  onQuickAdd:    (b: Beverage) => void;
  cartQuantity?: number;   // Fix 8: how many are already in cart
  style?:        React.CSSProperties;
}

export function BeverageCard({ beverage, onClick, onQuickAdd, cartQuantity = 0, style }: BeverageCardProps) {
  // Brief "added" flash on the quick-add button
  const [justAdded, setJustAdded] = useState(false);

  if (!beverage.isAvailable) return null;

  const isGold = beverage.isVip || beverage.isFeatured;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();          // don't open the modal
    onQuickAdd(beverage);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    // Outer wrapper — NOT a button so the two inner buttons work independently
    <div
      style={style}
      className={cn(
        "group relative w-full rounded-2xl overflow-hidden",
        "border transition-all duration-300",
        "bg-card shadow-card animate-fade-up",
        isGold
          ? "border-gold-500/30"
          : "border-edge",
      )}
    >
      {/* Card sheen */}
      <div className="absolute inset-0 bg-card-sheen pointer-events-none" />

      {/* VIP / Featured ribbon */}
      {isGold && (
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden z-10">
          <div className={cn(
            "text-[8px] font-bold uppercase tracking-widest text-center py-0.5",
            "rotate-45 translate-x-3.5 translate-y-2.5 w-16 shadow",
            beverage.isVip ? "bg-gold-grad text-void" : "bg-felt-500/90 text-white",
          )}>
            {beverage.isVip ? "VIP" : "Pick"}
          </div>
        </div>
      )}

      {/* ── Tappable card body → opens detail modal ── */}
      <button
        onClick={() => onClick(beverage)}
        aria-label={`View details for ${beverage.name}`}
        className="w-full text-left active:scale-[0.98] transition-transform"
      >
        {/* Emoji area */}
        <div className="relative h-28 flex items-center justify-center overflow-hidden bg-gradient-to-b from-lift to-card">
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            isGold
              ? "bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(212,150,10,0.18),transparent)]"
              : "bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(16,185,129,0.13),transparent)]",
          )} />

          <BeverageImage
            imageUrl={beverage.imageUrl}
            emoji={beverage.emoji}
            name={beverage.name}
            emojiClassName="text-5xl"
          />

          {/* In-cart quantity badge — Fix 8 */}
          {cartQuantity > 0 && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-felt-500/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-felt-glow">
              <span className="text-[10px] font-mono font-bold text-white">{cartQuantity} in order</span>
            </div>
          )}

          {/* Prep time badge */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-void/70 backdrop-blur-sm rounded-full px-2 py-0.5">
            <Clock size={9} className="text-gold-400" />
            <span className="text-[9px] font-mono text-mist-200">{beverage.prepMinutes}m</span>
          </div>

          {/* Non-alc badge */}
          {!beverage.isAlcoholic && (
            <div className="absolute bottom-2 left-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-sky-600/60 text-sky-200 border border-sky-500/25 rounded-full px-1.5 py-0.5 backdrop-blur-sm">
                Non-Alc
              </span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="px-3.5 pt-3 pb-2">
          <div className="flex items-start justify-between gap-1.5 mb-0.5">
            <h3 className={cn(
              "font-display font-semibold text-lg leading-tight",
              isGold ? "text-gold-300" : "text-white",
            )}>
              {beverage.name}
            </h3>
            {beverage.isVip && <Star size={12} className="text-gold-400 fill-gold-400 mt-1.5 flex-shrink-0" />}
          </div>
          <p className="text-mist-400 text-[11px] font-body leading-relaxed line-clamp-2">
            {beverage.tagline}
          </p>
          {/* "Tap for details" hint */}
          <div className="flex items-center gap-1 mt-1.5">
            <Info size={10} className="text-mist-600" />
            <span className="text-[10px] text-mist-600 font-body">Tap for details</span>
          </div>
        </div>
      </button>

      {/* ── Bottom action bar — always visible ── */}
      <div className={cn(
        "flex items-center justify-between px-3.5 py-3 border-t",
        isGold ? "border-gold-600/15" : "border-edge",
      )}>
        {/* Price */}
        <div>
          <span className={cn(
            "font-mono font-bold text-base",
            isGold ? "text-gold-300" : "text-white",
          )}>
            {fmtUSD(beverage.price)}
          </span>
          <p className="text-[10px] text-mist-600 font-mono">per drink</p>
        </div>

        {/* Quick-add button — prominent, always visible */}
        <button
          onClick={handleQuickAdd}
          aria-label={`Add ${beverage.name} to order`}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl",
            "text-sm font-body font-bold",
            "transition-all duration-200 active:scale-95",
            justAdded
              ? "bg-felt-600/25 border border-felt-500/30 text-felt-300"
              : isGold
              ? "bg-gold-grad text-void shadow-btn-gold"
              : "bg-felt-grad text-white shadow-btn-felt",
          )}
        >
          {justAdded
            ? <><Check size={14} /> Added</>
            : cartQuantity > 0
            ? <><Plus size={14} /> Add Another</>
            : <><Plus size={14} /> Add to Order</>
          }
        </button>
      </div>
    </div>
  );
}
