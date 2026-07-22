"use client";

/**
 * CategoryNav — premium horizontal category navigation with discoverability cues.
 *
 * Three non-intrusive layers that answer the guest's unasked question
 * "are there more categories?":
 *
 *  1. Edge fade gradients — strongest spatial cue. Right fade fades categories
 *     into the background colour implying content continues. Left fade appears
 *     after the guest scrolls to show content is behind them.
 *
 *  2. Scroll progress bar — a 2px gold track below the pills. The thumb
 *     position and width shows exactly where the guest is in the list and
 *     how much remains. Disappears when all categories fit without scrolling.
 *
 *  3. First-time hint — "Swipe to explore →" in small gold monospace text.
 *     Checked against sessionStorage so it only shows once per session.
 *     Fades out the instant the guest scrolls or taps any category.
 *     Height is fixed so dismissal never causes a layout shift.
 *
 * All three additions are aria-hidden — they are decorative affordances
 * for sighted users. Screen readers use the existing role="tablist" on
 * the scroll container.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_META } from "@/lib/data";
import type { BeverageCategory } from "@/lib/data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryTab {
  cat:   BeverageCategory;
  count: number;
}

interface CategoryNavProps {
  tabs:           CategoryTab[];
  activeCategory: BeverageCategory;
  onSelect:       (cat: BeverageCategory) => void;
}

// sessionStorage key — once set, hint never shows again for this session
const HINT_SEEN_KEY = "casino_cat_hint_seen";

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryNav({ tabs, activeCategory, onSelect }: CategoryNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll state
  const [scrollProgress, setScrollProgress] = useState(0);   // 0–1
  const [thumbWidthPct,  setThumbWidthPct]  = useState(100); // % of track
  const [canScroll,      setCanScroll]      = useState(false);
  const [isAtStart,      setIsAtStart]      = useState(true);
  const [isAtEnd,        setIsAtEnd]        = useState(false);

  // Hint state — fixed height, opacity-only transition to prevent layout shift
  const [showHint, setShowHint] = useState(false);

  // ── Measure scrollability on mount and whenever tabs change ──────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // rAF ensures the DOM has painted and measurements are accurate
    const id = requestAnimationFrame(() => {
      const overflow = el.scrollWidth - el.clientWidth;
      const scrollable = overflow > 8;
      setCanScroll(scrollable);
      setThumbWidthPct(scrollable ? (el.clientWidth / el.scrollWidth) * 100 : 100);
      setIsAtEnd(!scrollable);

      // Show hint if: scroll is needed AND guest hasn't seen it this session
      if (scrollable) {
        try {
          setShowHint(!sessionStorage.getItem(HINT_SEEN_KEY));
        } catch {
          setShowHint(true); // storage blocked — show it
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [tabs]);

  // ── Scroll handler — updates progress and dismisses hint ─────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const pos       = maxScroll > 0 ? scrollLeft / maxScroll : 0;

    setScrollProgress(pos);
    setIsAtStart(scrollLeft < 6);
    setIsAtEnd(pos > 0.97);

    // Dismiss hint on first meaningful scroll
    if (scrollLeft > 4 && showHint) {
      dismissHint();
    }
  }, [showHint]);

  // Mouse click-and-drag support for desktop users
  const isDragging   = useRef(false);
  const dragStartX   = useRef(0);
  const dragScrollX  = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current  = true;
    dragStartX.current  = e.pageX;
    dragScrollX.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = "grabbing";
    scrollRef.current.style.userSelect = "none";
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.pageX - dragStartX.current;
    scrollRef.current.scrollLeft = dragScrollX.current - dx;
  }, []);

  const onMouseUp = useCallback(() => {
    if (!scrollRef.current) return;
    isDragging.current = false;
    scrollRef.current.style.cursor = "grab";
    scrollRef.current.style.userSelect = "";
  }, []);  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { sessionStorage.setItem(HINT_SEEN_KEY, "1"); } catch {}
  }, []);

  // ── Category tap — dismiss hint and propagate ─────────────────────────────
  const handleSelect = useCallback((cat: BeverageCategory) => {
    if (showHint) dismissHint();
    onSelect(cat);
  }, [onSelect, showHint, dismissHint]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 bg-base/92 backdrop-blur-xl border-b border-edge animate-fade-up"
      style={{ animationDelay: "0.14s" }}
    >

      {/* ── First-time hint ─────────────────────────────────────────────────
          Fixed height (h-7) — opacity-only transition so sticky container
          height never changes and no layout shift occurs on dismissal.      */}
      <div
        aria-hidden
        className={cn(
          "h-7 flex items-center justify-end gap-1 px-5",
          "transition-opacity duration-700 ease-out",
          showHint && canScroll ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <span className="text-[9px] font-mono text-gold-500/60 uppercase tracking-[0.18em]">
          Swipe to explore
        </span>
        {/* Gentle right-pointing arrow — animates as a subtle pulse */}
        <ChevronRight
          size={9}
          className="text-gold-500/60 animate-bounce-x"
          aria-hidden
        />
      </div>

      {/* ── Scroll row with edge fades ───────────────────────────────────── */}
      <div className="relative py-2">

        {/* Left fade — reveals itself after the guest has scrolled right,
            confirming that content exists behind their current position.   */}
        <div
          aria-hidden
          className={cn(
            "absolute left-0 inset-y-0 w-8 z-10 pointer-events-none",
            "bg-gradient-to-r from-base/95 to-transparent",
            "transition-opacity duration-300",
          )}
          style={{ opacity: isAtStart ? 0 : 1 }}
        />

        {/* Category pills — unchanged markup, same classes as before */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="flex gap-2 overflow-x-auto no-scrollbar px-4 cursor-grab"
          role="tablist"
          aria-label="Drink categories"
        >
          {tabs.map(({ cat, count }) => {
            const meta   = CATEGORY_META[cat];
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={active}
                onClick={() => handleSelect(cat)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl",
                  "text-sm font-body font-medium border transition-all duration-200 active:scale-95",
                  active
                    ? "bg-felt-grad text-white border-transparent shadow-felt-glow"
                    : "bg-card border-edge text-mist-400 hover:text-mist-100 hover:border-rim",
                )}
              >
                <span aria-hidden>{meta.emoji}</span>
                {meta.shortLabel}
                <span className={cn(
                  "text-[10px] font-mono rounded-full px-1.5 py-0",
                  active ? "bg-white/20 text-white" : "bg-lift text-mist-400",
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right fade — the primary discoverability signal. Blends the last
            visible pill into the background colour, making it unmistakably
            clear to any guest that the list continues to the right.        */}
        <div
          aria-hidden
          className={cn(
            "absolute right-0 inset-y-0 w-14 z-10 pointer-events-none",
            "bg-gradient-to-l from-base/95 to-transparent",
            "transition-opacity duration-300",
          )}
          style={{ opacity: canScroll && !isAtEnd ? 1 : 0 }}
        />

      </div>

      {/* ── Scroll progress bar ──────────────────────────────────────────────
          Only renders when the list is wider than the viewport.
          The thumb size and position mirror a real scrollbar:
            - thumbWidthPct = clientWidth / scrollWidth  (how much is visible)
            - left offset   = progress × (100 - thumbWidthPct)  (position)    */}
      {canScroll && (
        <div aria-hidden className="px-4 pb-2.5">
          <div className="h-[2px] rounded-full bg-edge/50 relative overflow-hidden">
            <div
              className="absolute top-0 h-full bg-gold-grad rounded-full"
              style={{
                width:      `${thumbWidthPct}%`,
                left:       `${scrollProgress * (100 - thumbWidthPct)}%`,
                transition: "left 180ms ease-out, width 180ms ease-out",
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
