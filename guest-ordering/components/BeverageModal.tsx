"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Minus, Plus, Clock, Star, Leaf,
  ChevronDown, ChevronUp, ShoppingBag, Check,
} from "lucide-react";
import { cn, fmtUSD } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { BeverageImage } from "./BeverageImage";
import type { Beverage } from "@/lib/data";
import { GIANT_UPCHARGE } from "@/lib/data";

interface BeverageModalProps {
  beverage:            Beverage | null;
  giantCupsAvailable:  number;
  onClose:             () => void;
  onOrder:             (beverage: Beverage, qty: number, note: string, size: "regular" | "giant") => void;
}

type BtnState = "idle" | "loading" | "done";

export function BeverageModal({ beverage, giantCupsAvailable, onClose, onOrder }: BeverageModalProps) {
  const [qty,      setQty]      = useState(1);
  const [note,     setNote]     = useState("");
  const [showNote, setShowNote] = useState(false);
  const [btnState, setBtnState] = useState<BtnState>("idle");
  const [qtyKey,   setQtyKey]   = useState(0);
  const [size,     setSize]     = useState<"regular" | "giant">("regular");
  const panelRef = useRef<HTMLDivElement>(null);

  // Fix 9 — focus trap: keyboard stays inside modal, Escape closes it
  useFocusTrap(panelRef, !!beverage);

  useEffect(() => {
    if (beverage) {
      setQty(1);
      setNote("");
      setShowNote(false);
      setBtnState("idle");
      setSize("regular");
    }
  }, [beverage?.id]);

  useEffect(() => {
    if (beverage) document.body.classList.add("modal-open");
    else          document.body.classList.remove("modal-open");
    return ()  => document.body.classList.remove("modal-open");
  }, [beverage]);

  useEffect(() => {
    if (!beverage) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [beverage, onClose]);

  const adjustQty = useCallback((delta: number) => {
    setQty(q => {
      const next = Math.min(8, Math.max(1, q + delta));
      if (next !== q) setQtyKey(k => k + 1);
      return next;
    });
  }, []);

  const handleOrder = async () => {
    if (!beverage || btnState !== "idle") return;
    setBtnState("loading");
    await new Promise(r => setTimeout(r, 750));
    onOrder(beverage, qty, note, size);
    setBtnState("done");
    await new Promise(r => setTimeout(r, 600));
    onClose();
  };

  if (!beverage) return null;

  const isGold        = beverage.isVip || beverage.isFeatured;
  const effectivePrice = beverage.price + (beverage.isAlcoholic && size === "giant" ? GIANT_UPCHARGE : 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-void/85 backdrop-blur-md animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Full-viewport flex wrapper — the only centering method that works
          regardless of parent transforms, backdrop-filters, or animations     */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">

        {/* Modal panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Order ${beverage.name}`}
          ref={panelRef}
          className="pointer-events-auto w-full max-w-md rounded-3xl overflow-hidden shadow-modal bg-card flex flex-col max-h-[88dvh] animate-scale-in"
        >

          {/* Top colour stripe */}
          <div className={cn("flex-shrink-0 w-full", isGold ? "h-1 bg-gold-grad" : "h-[2px] bg-felt-grad")} />

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-lift/90 backdrop-blur-sm flex items-center justify-center text-mist-300 hover:text-white hover:bg-rim transition-all"
          >
            <X size={15} />
          </button>

          {/* ── Scrollable drink details ── */}
          <div className="overflow-y-auto flex-1 overscroll-contain">

            {/* Hero */}
            <div className={cn(
              "relative h-28 flex items-center justify-center overflow-hidden",
              isGold ? "bg-gradient-to-b from-gold-700/25 via-lift to-card"
                     : "bg-gradient-to-b from-felt-700/15 via-lift to-card",
            )}>
              <div className={cn("absolute inset-0", isGold
                ? "bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(212,150,10,0.25),transparent)]"
                : "bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(16,185,129,0.18),transparent)]")} />
              <BeverageImage
                imageUrl={beverage.imageUrl}
                emoji={beverage.emoji}
                name={beverage.name}
                emojiClassName="text-[52px] animate-scale-in"
              />
              {/* Available pill */}
              <div className="absolute top-3.5 left-4 flex items-center gap-1.5 bg-void/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-pulse-dot absolute h-full w-full rounded-full bg-felt-400 opacity-75" />
                  <span className="relative h-2 w-2 rounded-full bg-felt-500 inline-flex" />
                </span>
                <span className="text-[10px] font-mono text-felt-300 uppercase tracking-wider">Available</span>
              </div>
              {/* VIP badge */}
              {beverage.isVip && (
                <div className="absolute top-3.5 right-12 flex items-center gap-1 bg-gold-500/15 border border-gold-400/25 rounded-full px-2.5 py-1">
                  <Star size={10} className="text-gold-400 fill-gold-400" />
                  <span className="text-[10px] font-mono text-gold-300 uppercase tracking-wider">VIP</span>
                </div>
              )}
            </div>

            {/* Drink info */}
            <div className="px-5 pt-3 pb-3 space-y-3">

              {/* Name + tagline */}
              <div>
                <h2 className={cn("font-display text-[1.6rem] font-semibold leading-tight mb-1",
                  isGold ? "text-gold-200" : "text-white")}>
                  {beverage.name}
                </h2>
                <p className={cn("text-sm font-body font-medium",
                  isGold ? "text-gold-400/80" : "text-felt-400/90")}>
                  {beverage.tagline}
                </p>
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 mt-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-mist-400">
                    <Clock size={11} className="text-gold-500" />
                    {beverage.prepMinutes} min prep
                  </div>
                  {beverage.isSignature && (
                    <div className="flex items-center gap-1 text-xs font-mono text-felt-400">
                      <Leaf size={10} />Signature
                    </div>
                  )}
                  {!beverage.isAlcoholic && (
                    <span className="text-[10px] font-mono text-sky-400 bg-sky-400/10 border border-sky-400/20 rounded-full px-2 py-0.5">
                      Non-alcoholic
                    </span>
                  )}
                  <span className={cn("text-sm font-mono font-bold ml-auto",
                    isGold ? "text-gold-300" : "text-white")}>
                    {fmtUSD(effectivePrice)}
                    {size === "giant" && (
                      <span className="ml-1 text-[10px] text-blue-400 font-mono normal-case">+$1 giant</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {beverage.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {beverage.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-mono uppercase tracking-wider text-mist-400 bg-lift border border-edge rounded-full px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-rim to-transparent" />

              {/* Description */}
              <p className="text-mist-200 text-sm font-body leading-relaxed">
                {beverage.description}
              </p>

              {/* Ingredients */}
              <div className="bg-lift/60 border border-edge rounded-2xl px-4 py-3">
                <p className="text-[10px] font-mono text-mist-500 uppercase tracking-widest mb-2">Ingredients</p>
                <ul className="space-y-1.5">
                  {beverage.ingredients.map(ing => (
                    <li key={ing} className="flex items-center gap-2.5 text-sm text-mist-200 font-body">
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                        isGold ? "bg-gold-400" : "bg-felt-500")} />
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pairing note */}
              {beverage.pairsWith && (
                <p className="text-[11px] text-mist-500 font-body italic leading-relaxed">
                  {beverage.pairsWith}
                </p>
              )}

            </div>
          </div>
          {/* end scrollable content */}

          {/* ── Sticky order footer — always visible ── */}
          <div className={cn(
            "flex-shrink-0 border-t px-5 pt-3 pb-4 space-y-3 bg-card",
            isGold ? "border-gold-600/20" : "border-edge",
          )}>

            {/* Size selector — alcoholic drinks only, excluding shots and any
                drink flagged giantAvailable === false (BuzzBallz, Big Sipz). */}
            {beverage.isAlcoholic && beverage.category !== "shot" && beverage.giantAvailable !== false && (
              <>
                <div className="flex gap-2">
                  {(["regular", "giant"] as const).map(s => {
                    const isGiantOption  = s === "giant";
                    const giantUnavail   = isGiantOption && giantCupsAvailable === 0;
                    const isSelected     = size === s;
                    return (
                      <button
                        key={s}
                        onClick={() => { if (!giantUnavail) setSize(s); }}
                        disabled={giantUnavail}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl border text-sm font-body font-semibold transition-all",
                          isSelected && !giantUnavail
                            ? isGiantOption
                              ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                              : "bg-felt-600/20 border-felt-500/40 text-felt-300"
                            : giantUnavail
                            ? "bg-lift/40 border-edge text-mist-700 cursor-not-allowed"
                            : "bg-lift border-edge text-mist-400 hover:border-rim hover:text-white",
                        )}
                      >
                        {s === "regular" ? "Regular" : `Giant +$${GIANT_UPCHARGE}`}
                      </button>
                    );
                  })}
                </div>
                {giantCupsAvailable === 0 && (
                  <p className="text-[11px] text-mist-600 font-body text-center -mt-1">
                    Giant cups currently unavailable — check back soon
                  </p>
                )}
              </>
            )}

            {/* Quantity + note toggle row */}
            <div className="flex items-center justify-between gap-4">

              {/* Quantity selector */}
              <div className="flex items-center gap-3 bg-lift border border-edge rounded-2xl px-3 py-2">
                <button
                  onClick={() => adjustQty(-1)}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90",
                    qty <= 1 ? "text-mist-700 cursor-not-allowed" : "text-mist-200 hover:bg-rim hover:text-white")}
                >
                  <Minus size={16} />
                </button>
                <span
                  key={qtyKey}
                  className={cn("font-display font-bold text-2xl leading-none w-8 text-center animate-qty-pop",
                    isGold ? "text-gold-200" : "text-white")}
                >
                  {qty}
                </span>
                <button
                  onClick={() => adjustQty(1)}
                  disabled={qty >= 8}
                  aria-label="Increase quantity"
                  className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90",
                    qty >= 8 ? "text-mist-700 cursor-not-allowed" : "text-mist-200 hover:bg-rim hover:text-white")}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Note toggle */}
              <button
                onClick={() => setShowNote(s => !s)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-body px-3 py-2 rounded-xl border transition-all",
                  showNote
                    ? "border-felt-600/40 text-felt-400 bg-felt-600/10"
                    : "border-edge text-mist-500 hover:text-mist-200 hover:border-rim",
                )}
              >
                {showNote ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Note
              </button>

            </div>

            {/* Special request textarea */}
            {showNote && (
              <textarea
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={160}
                placeholder="e.g. extra ice, no sugar, lighter on the mixer, neat…"
                className="w-full bg-lift border border-edge rounded-2xl px-4 py-3 text-sm text-mist-100 placeholder-mist-600 font-body resize-none focus:outline-none focus:border-felt-600/50 transition-colors animate-fade-in"
              />
            )}

            {/* Order button */}
            <button
              onClick={handleOrder}
              disabled={btnState !== "idle"}
              aria-label={`Add ${qty} ${beverage.name} to order`}
              className={cn(
                "w-full py-4 rounded-2xl font-body font-bold text-base",
                "flex items-center justify-center gap-3",
                "transition-all duration-300 active:scale-[0.98]",
                btnState === "done"
                  ? "bg-felt-600/20 border border-felt-500/30 text-felt-300"
                  : isGold
                  ? "bg-gold-grad text-void shadow-btn-gold hover:brightness-110"
                  : "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
                btnState !== "idle" && "cursor-default",
              )}
            >
              {btnState === "loading" && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {btnState === "done"    && <Check size={19} className="animate-scale-in" />}
              {btnState === "idle"   && <ShoppingBag size={19} />}
              <span>
                {btnState === "idle"    && `Add to Order${qty > 1 ? ` ×${qty}` : ""} — ${fmtUSD(effectivePrice * qty)}`}
                {btnState === "loading" && "Adding to your order…"}
                {btnState === "done"    && "Added to your order!"}
              </span>
            </button>

            {/* Reassurance */}
            {btnState === "idle" && (
              <p className="text-center text-[11px] text-mist-600 font-body -mt-1">
                Delivered to your seat · No payment needed now
              </p>
            )}

          </div>
          {/* end sticky footer */}

        </div>
        {/* end modal panel */}

      </div>
      {/* end flex centering wrapper */}
    </>
  );
}
