"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  MapPin, ShoppingBag, Star, Sparkles, ChevronRight, Check, Clock,
} from "lucide-react";
import { BeverageCard }      from "@/components/BeverageCard";
import { BeverageImage }     from "@/components/BeverageImage";
import { BeverageModal }     from "@/components/BeverageModal";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { OrderReviewModal }  from "@/components/OrderReviewModal";
import { MyOrdersPanel }     from "@/components/MyOrdersPanel";
import { AgeGate, AgeGateDeclined, hasVerifiedAge, hasDeclinedAge, getAgeVerificationMeta, isUnderageSession, getGuestName } from "@/components/AgeGate";
import { CategoryNav, type CategoryTab } from "@/components/CategoryNav";
import { useMenu }           from "@/hooks/useMenu";
import { useCart }           from "@/hooks/useCart";
import { useOrderHistory, type HistoryOrder } from "@/hooks/useOrderHistory";
import {
  submitOrder, calculateETA, getQueueDepth, readAlcoholCooldownMs,
  type QueuedOrder,
} from "@/lib/queue";
import {
  MENU_CATEGORIES, CATEGORY_META,
  type Beverage, type BeverageCategory, type PlacedOrder,
} from "@/lib/data";
import { cn, fmtUSD, generateOrderId } from "@/lib/utils";
import { HOLIDAY_THEME_ACTIVE } from "@/lib/config";
import { getOrCreateGuestId } from "@/lib/guestSession";

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ locationId: string }>;
}

function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GuestOrderPage({ params }: Props) {
  const { locationId } = React.use(params);

  const { beverages, locations, loading: menuLoading } = useMenu();
  const location = locations.find(l => l.id === locationId);

  // Persistent guest identifier — a UUID cookie that survives refresh and
  // closing/reopening the tab, unlike the sessionStorage state used elsewhere
  // on this page. Established once per mount; same value handed to every
  // order this guest places until the cookie expires (24h).
  const guestIdRef = useRef<string | null>(null);
  useEffect(() => {
    guestIdRef.current = getOrCreateGuestId();
  }, []);

  // Real alcohol cooldown, synced from the server (the same check enforced
  // on order submission) — not a local timer, so refreshing the page shows
  // the true remaining time instead of resetting it. Hidden entirely once
  // it hits zero; there's nothing useful to show a guest with no active
  // cooldown.
  const [cooldownMs, setCooldownMs] = useState(0);

  const refreshCooldown = useCallback(async () => {
    const gid = guestIdRef.current ?? getOrCreateGuestId();
    const ms = await readAlcoholCooldownMs(gid);
    setCooldownMs(ms);
  }, []);

  // Sync with the server on mount, then periodically — catches a cooldown
  // that started from another tab/device using the same guest cookie
  useEffect(() => {
    refreshCooldown();
    const id = setInterval(refreshCooldown, 30_000);
    return () => clearInterval(id);
  }, [refreshCooldown]);

  // Local 1s tick between server syncs for a smooth, real-time countdown
  useEffect(() => {
    const id = setInterval(() => {
      setCooldownMs(prev => (prev > 1000 ? prev - 1000 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── State ──────────────────────────────────────────────────────────────────

  // Category preserved in ref so it survives order-more cycles
  const [activeCategory, setActiveCategory] = useState<BeverageCategory>("cocktail");
  const savedCategory   = useRef<BeverageCategory>("cocktail");

  const [selectedBeverage, setSelected]   = useState<Beverage | null>(null);
  const [showReview,       setShowReview] = useState(false);
  const [showOrders,       setShowOrders] = useState(false);
  const [placedOrder,      setPlacedOrder]= useState<PlacedOrder | null>(null);
  const [placingOrder,     setPlacingOrder]= useState(false);
  const [toast,            setToast]      = useState<string | null>(null);

  // Session order history — persisted in sessionStorage, polled for live status
  const { orders: sessionOrders, addOrder, activeCount, refreshNow } = useOrderHistory(locationId);

  // Age gate state (client-only, SSR-safe).
  const [ageState, setAgeState] = useState<"checking" | "verified" | "declined">("checking");
  const [isUnderage, setIsUnderage] = useState(false);
  const [guestDisplayName, setGuestDisplayName] = useState<string | null>(null);
  useEffect(() => {
    if (hasDeclinedAge())      setAgeState("declined");
    else if (hasVerifiedAge()) setAgeState("verified");
    else                       setAgeState("checking");
    setIsUnderage(isUnderageSession());
    setGuestDisplayName(getGuestName());
  }, []);

  // Persistent cart (sessionStorage)
  const {
    cart, cartCount, cartTotal, hydrated,
    addItem, removeItem, updateQty, clearItems,
    recordAlcoholicOrder,
  } = useCart(locationId);

  // Scroll position saved before confirmation, restored after "Order More"
  const savedScrollY = useRef(0);

  // Featured strip scroll tracking — for edge fade discoverability
  const featuredRef    = useRef<HTMLDivElement>(null);
  const [featuredAtStart, setFeaturedAtStart] = useState(true);
  const [featuredAtEnd,   setFeaturedAtEnd]   = useState(false);
  const handleFeaturedScroll = useCallback(() => {
    const el = featuredRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setFeaturedAtStart(scrollLeft < 6);
    setFeaturedAtEnd(scrollLeft + clientWidth >= scrollWidth - 6);
  }, []);

  // Mouse click-and-drag for the featured strip
  const featuredDragging  = useRef(false);
  const featuredDragStartX= useRef(0);
  const featuredDragScrollX=useRef(0);
  const onFeaturedMouseDown = useCallback((e: React.MouseEvent) => {
    if (!featuredRef.current) return;
    featuredDragging.current   = true;
    featuredDragStartX.current = e.pageX;
    featuredDragScrollX.current= featuredRef.current.scrollLeft;
    featuredRef.current.style.cursor     = "grabbing";
    featuredRef.current.style.userSelect = "none";
  }, []);
  const onFeaturedMouseMove = useCallback((e: React.MouseEvent) => {
    if (!featuredDragging.current || !featuredRef.current) return;
    featuredRef.current.scrollLeft = featuredDragScrollX.current - (e.pageX - featuredDragStartX.current);
  }, []);
  const onFeaturedMouseUp = useCallback(() => {
    if (!featuredRef.current) return;
    featuredDragging.current = false;
    featuredRef.current.style.cursor     = "grab";
    featuredRef.current.style.userSelect = "";
  }, []);

  // Prevent duplicate submissions
  const isConfirming = useRef(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  // Underage sessions only ever see non-alcoholic beverages — filtered once
  // here so every downstream section (featured strip, tabs, menu grid)
  // automatically inherits the restriction with no further special-casing.
  const visibleBeverages = useMemo(
    () => isUnderage ? beverages.filter(b => !b.isAlcoholic) : beverages,
    [beverages, isUnderage],
  );

  const featured   = useMemo(() => visibleBeverages.filter(b => b.isFeatured && b.isAvailable), [visibleBeverages]);
  const menuDrinks = useMemo(
    () => visibleBeverages.filter(b => b.category === activeCategory && b.isAvailable),
    [visibleBeverages, activeCategory],
  );

  // Lookup how many of each beverage are in cart
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) map.set(item.beverage.id, item.quantity);
    return map;
  }, [cart]);

  // Category tabs — pre-filtered and counted for CategoryNav. A category
  // that would show zero results (e.g. every alcoholic category for an
  // underage session) is hidden entirely rather than shown empty.
  const tabs = useMemo<CategoryTab[]>(() =>
    MENU_CATEGORIES
      .map(cat => ({ cat, count: visibleBeverages.filter(b => b.category === cat && b.isAvailable).length }))
      .filter(t => t.count > 0),
    [visibleBeverages],
  );

  // If the active category has no visible items (e.g. defaulted to
  // "cocktail" but this is an underage session), fall back to the first
  // category that actually has something to show.
  useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some(t => t.cat === activeCategory)) {
      setActiveCategory(tabs[0].cat);
    }
  }, [tabs, activeCategory]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddToOrder = useCallback((beverage: Beverage, qty: number, note: string) => {
    const { added, capped, cooldownMs } = addItem(beverage, qty, note);
    if (added === 0) {
      const mins = Math.max(1, Math.ceil(cooldownMs / 60_000));
      setToast(`Drink limit reached — try again in ${mins} minute${mins !== 1 ? "s" : ""}`);
    } else if (capped) {
      setToast(`Added ${added} — drink limit reached for now`);
    } else {
      setToast(`${beverage.name} added`);
    }
    setTimeout(() => setToast(null), 3500);
  }, [addItem]);

  const handleQuickAdd = useCallback((beverage: Beverage) => {
    handleAddToOrder(beverage, 1, "");
  }, [handleAddToOrder]);

  // Re-place a past order's items into the current cart. Each item is
  // re-resolved against the live menu (current price/availability) rather
  // than the snapshot stored in history, and added one at a time through
  // the same addItem() the rest of the app uses — so the 2-drink alcoholic
  // cap and cooldown are enforced exactly as they would be for a fresh add,
  // and non-alcoholic items in a mixed order are never affected by either.
  const handleReorder = useCallback((order: HistoryOrder) => {
    let addedCount = 0;
    let unavailableCount = 0;
    let anyAlcoholCapped = false;
    let alcoholCooldownMins = 0;

    for (const item of order.items) {
      const live = beverages.find(b => b.id === item.beverage.id);
      if (!live || !live.isAvailable) { unavailableCount++; continue; }

      const { added, capped, cooldownMs: itemCooldownMs } = addItem(live, item.quantity, item.note);
      addedCount += added;
      if (added < item.quantity) anyAlcoholCapped = true;
      if (added === 0 && live.isAlcoholic) {
        alcoholCooldownMins = Math.max(alcoholCooldownMins, Math.max(1, Math.ceil(itemCooldownMs / 60_000)));
      }
    }

    setShowOrders(false);

    if (addedCount === 0) {
      setToast(
        alcoholCooldownMins > 0
          ? `Drink limit reached — try again in ${alcoholCooldownMins} minute${alcoholCooldownMins !== 1 ? "s" : ""}`
          : "Those items are no longer available"
      );
    } else if (unavailableCount > 0 || anyAlcoholCapped) {
      setToast(`Added ${addedCount} item${addedCount !== 1 ? "s" : ""} — some couldn't be added`);
    } else {
      setToast("Added to your order");
    }
    setTimeout(() => setToast(null), 3500);
  }, [beverages, addItem]);

  const removeFromCart = useCallback((beverageId: string) => {
    removeItem(beverageId);
    if (cart.filter(i => i.beverage.id !== beverageId).length === 0) {
      setShowReview(false);
    }
  }, [removeItem, cart]);

  const updateCartQty = useCallback((beverageId: string, delta: number) => {
    updateQty(beverageId, delta);
  }, [updateQty]);

  const handleOpenReview = useCallback(() => {
    if (cart.length === 0) return;
    setShowReview(true);
  }, [cart.length]);

  // Order submission with queue-aware ETA
  const handleConfirmOrder = useCallback(async () => {
    if (cart.length === 0 || isConfirming.current || !location) return;
    isConfirming.current = true;
    setPlacingOrder(true);

    // ETA accounts for how busy the bar currently is
    const queueDepth       = await getQueueDepth();
    const estimatedMinutes = calculateETA(cart, queueDepth);

    const orderId = generateOrderId();
    const now     = new Date().toISOString();

    // Submit to Supabase (falls back to localStorage queue if unavailable)
    const ageMeta = getAgeVerificationMeta();
    const queued: QueuedOrder = {
      id: orderId,
      locationId,
      locationName:     location.name,
      section:          location.section,
      floor:            location.floor,
      items:            [...cart],
      estimatedMinutes,
      placedAt:         now,
      status:           "pending",
      ageBracket:       ageMeta?.ageBracket,
      ageVerifiedAt:    ageMeta?.verifiedAt,
      guestId:          guestIdRef.current ?? getOrCreateGuestId(),
      guestName:        getGuestName(),
    };
    const result = await submitOrder(queued);

    if (result.rateLimited) {
      setPlacingOrder(false);
      isConfirming.current = false;
      setToast("You're ordering too quickly — please wait a moment and try again");
      setTimeout(() => setToast(null), 3500);
      return;
    }

    if (result.cooldownBlocked) {
      setPlacingOrder(false);
      isConfirming.current = false;
      setCooldownMs(result.cooldownMs ?? 0);
      const mins = Math.max(1, Math.ceil((result.cooldownMs ?? 0) / 60_000));
      setToast(`Drink limit reached — try again in ${mins} minute${mins !== 1 ? "s" : ""}`);
      setTimeout(() => setToast(null), 3500);
      return;
    }

    await new Promise(r => setTimeout(r, 900));

    const placed: PlacedOrder = {
      id: orderId,
      locationName:     location.name,
      items:            [...cart],
      estimatedMinutes,
      placedAt:         now,
    };

    // Save to session history before switching to confirmation screen
    addOrder({
      id:               orderId,
      locationName:     location.name,
      items:            [...cart],
      estimatedMinutes,
      placedAt:         now,
    });

    // Save scroll position before switching to confirmation screen
    savedScrollY.current   = window.scrollY;
    savedCategory.current  = activeCategory;

    // Record alcoholic drinks just placed so the 10-minute window correctly
    // limits how much more can be ordered this session
    const alcoholicQty = cart.reduce((s, i) => i.beverage.isAlcoholic ? s + i.quantity : s, 0);
    recordAlcoholicOrder(alcoholicQty);
    if (alcoholicQty > 0) refreshCooldown();

    clearItems();
    setShowReview(false);
    setPlacingOrder(false);
    setPlacedOrder(placed);
    isConfirming.current = false;
  }, [cart, location, locationId, activeCategory, clearItems, addOrder, recordAlcoholicOrder, refreshCooldown]);

  // Restore category and scroll position when returning from confirmation
  const handleOrderMore = useCallback(() => {
    setPlacedOrder(null);
    setActiveCategory(savedCategory.current);
    // Restore scroll after DOM has updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollY.current, behavior: "instant" });
      });
    });
  }, []);

  // Lock body scroll when any overlay is open
  useEffect(() => {
    const anyOpen = showReview || showOrders || !!selectedBeverage;
    document.body.classList.toggle("modal-open", anyOpen);
    return () => document.body.classList.remove("modal-open");
  }, [showReview, showOrders, selectedBeverage]);

  // ── Render gates ───────────────────────────────────────────────────────────

  // Age gate (SSR-safe: "checking" shows nothing until client hydrates)
  if (ageState === "checking") {
    return (
      <AgeGate
        onConfirm={() => { setIsUnderage(isUnderageSession()); setGuestDisplayName(getGuestName()); setAgeState("verified"); }}
        onDecline={() => setAgeState("declined")}
      />
    );
  }
  if (ageState === "declined") {
    return <AgeGateDeclined />;
  }

  if (placedOrder) {
    return <OrderConfirmation order={placedOrder} onOrderMore={handleOrderMore} />;
  }

  // Location not found — bad or stale QR code
  if (!menuLoading && !location) {
    return (
      <main className="min-h-screen bg-base flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <p className="text-4xl mb-4">❓</p>
          <h2 className="font-display text-2xl text-white mb-2">Location Not Found</h2>
          <p className="text-mist-400 text-sm font-body leading-relaxed">
            This QR code doesn&apos;t match an active location. Please scan the QR code at your table or ask a member of floor staff for assistance.
          </p>
        </div>
      </main>
    );
  }

  if (!location || !location.isActive) {
    return (
      <main className="min-h-screen bg-base flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <p className="text-4xl mb-4">🚫</p>
          <h2 className="font-display text-2xl text-white mb-2">Service Paused</h2>
          <p className="text-mist-400 text-sm font-body leading-relaxed">
            Ordering is temporarily unavailable at this location. Please speak with a member of our floor staff.
          </p>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-base pb-36">
      {/* Ambient grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage:"radial-gradient(circle,rgba(30,48,72,0.5) 1px,transparent 1px)", backgroundSize:"28px 28px" }}
      />
      <div className="fixed inset-0 pointer-events-none bg-hero-glow" />

      <div className="relative z-10 max-w-lg mx-auto">

        {/* ── STICKY HEADER ── */}
        <header className={cn(
          "sticky top-0 z-30 bg-base/92 backdrop-blur-xl",
          HOLIDAY_THEME_ACTIVE ? "border-b border-transparent" : "border-b border-edge",
        )}>
          <div className="px-4 h-14 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-mono text-gold-500/80 tracking-[0.25em] uppercase leading-none">
                The Grand Casino
              </p>
              {HOLIDAY_THEME_ACTIVE ? (
                <p className="flex items-center gap-1 text-sm font-body font-bold text-white mt-0.5 leading-tight truncate">
                  <MapPin size={12} className="text-gold-400 flex-shrink-0" />
                  <span className="truncate">{location.name}</span>
                </p>
              ) : (
                <p className="text-xs text-mist-400 font-body mt-0.5 leading-none">Beverage Service</p>
              )}
            </div>

            {/* Alcohol cooldown — only rendered while a real cooldown is
                active; nothing to show otherwise, so it never clutters the
                header for the common case */}
            {cooldownMs > 0 && (
              <div
                className="flex items-center gap-1 bg-gold-500/8 border border-gold-500/20 rounded-full px-2 py-1 flex-shrink-0"
                role="timer"
                aria-live="off"
                aria-label={`Drink cooldown: ${formatCooldown(cooldownMs)} remaining`}
              >
                <Clock size={11} className="text-gold-400 flex-shrink-0" />
                <span className="hidden sm:inline text-[9px] font-mono text-gold-400/80 uppercase tracking-wider">
                  Cooldown
                </span>
                <span className="text-[11px] font-mono font-semibold text-gold-300 tabular-nums">
                  {formatCooldown(cooldownMs)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-felt-500/8 border border-felt-500/15 rounded-full px-2.5 py-1 flex-shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-pulse-dot absolute h-full w-full rounded-full bg-felt-400 opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-felt-500 inline-flex" />
              </span>
              <span className="text-[10px] font-mono text-felt-400 uppercase tracking-wider">Open</span>
            </div>

            <div className="flex items-center gap-2">
              {/* My Orders button — shown once at least one order exists this session */}
              {sessionOrders.length > 0 && (
                <button
                  onClick={() => { setShowOrders(true); refreshNow(); }}
                  aria-label={`My Orders${activeCount > 0 ? ` — ${activeCount} in progress` : ""}`}
                  className="relative w-10 h-10 rounded-xl bg-lift border border-rim flex items-center justify-center text-mist-200 hover:border-gold-600/50 transition-colors"
                >
                  {/* Receipt icon — three lines */}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
                    <path d="M16 8H8M16 12H8M12 16H8"/>
                  </svg>
                  {/* Active order count badge */}
                  {activeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-gold-500 text-void text-[10px] font-bold font-mono rounded-full flex items-center justify-center px-1">
                      {activeCount}
                    </span>
                  )}
                  {/* Pulsing ring when active orders exist */}
                  {activeCount > 0 && (
                    <span className="absolute inset-0 rounded-xl border border-gold-500/50 animate-pulse-dot pointer-events-none" />
                  )}
                </button>
              )}

              {cartCount > 0 && (
                <button
                  onClick={handleOpenReview}
                  aria-label={`${cartCount} items in order`}
                  className="relative w-10 h-10 rounded-xl bg-lift border border-rim flex items-center justify-center text-mist-200 hover:border-felt-600/50 transition-colors"
                >
                  <ShoppingBag size={17} />
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-felt-500 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                </button>
              )}
            </div>
          </div>
          {HOLIDAY_THEME_ACTIVE && (
            <div className="h-[2px] bg-gradient-to-r from-red-500 via-mist-50 to-blue-500" aria-hidden />
          )}
        </header>

        {/* ── LOCATION BANNER ── */}
        <div className="px-4 pt-8 pb-6 text-center">
          {guestDisplayName && (
            <p className="text-mist-400 text-sm font-body mb-1.5 animate-fade-up">
              Welcome, {guestDisplayName}
            </p>
          )}
          {HOLIDAY_THEME_ACTIVE ? (
            <h1 className="font-display text-[2.6rem] font-semibold leading-tight mb-2 animate-fade-up">
              <span className="text-white">POUR</span>
              <span className="text-mist-500"> — </span>
              <span className="bg-gradient-to-r from-red-400 via-mist-50 to-blue-400 bg-clip-text text-transparent">
                Happy 4th of July
              </span>
            </h1>
          ) : (
            <h1 className="font-display text-[2.6rem] font-semibold text-white leading-tight mb-2 animate-fade-up">
              {location.name}
            </h1>
          )}
          <div className="flex items-center justify-center gap-1.5 text-mist-400 animate-fade-up" style={{ animationDelay:"0.05s" }}>
            <MapPin size={12} className="text-felt-500" />
            <span className="text-sm font-body">{location.section} · Floor {location.floor}</span>
          </div>
          {isUnderage && (
            <div className="flex justify-center mt-3 animate-fade-up" style={{ animationDelay:"0.08s" }}>
              <span className="inline-flex items-center gap-1.5 bg-lift/60 border border-edge rounded-full px-3 py-1 text-mist-400 text-[11px] font-body">
                🌿 Viewing our non-alcoholic menu
              </span>
            </div>
          )}
          <div className="flex items-center gap-4 mt-6 animate-fade-up" style={{ animationDelay:"0.1s" }}>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold-600/25" />
            <span className="text-[10px] font-mono text-gold-600/50 tracking-[0.25em] uppercase">Menu</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold-600/25" />
          </div>
        </div>

        {/* ── FEATURED STRIP ── */}
        {featured.length > 0 && (
          <section className="mb-8 animate-fade-up" style={{ animationDelay:"0.12s" }}>
            <div className="flex items-center gap-2 px-4 mb-3">
              <Sparkles size={13} className="text-gold-400" />
              <h2 className="text-xs font-mono text-gold-400/80 uppercase tracking-widest">
                Tonight's Recommendations
              </h2>
            </div>
            <div className="relative">
              {/* Left fade — appears after scrolling right */}
              <div
                aria-hidden
                className="absolute left-0 inset-y-0 w-8 z-10 pointer-events-none transition-opacity duration-300 bg-gradient-to-r from-base/95 to-transparent"
                style={{ opacity: featuredAtStart ? 0 : 1 }}
              />

              <div
                ref={featuredRef}
                onScroll={handleFeaturedScroll}
                onMouseDown={onFeaturedMouseDown}
                onMouseMove={onFeaturedMouseMove}
                onMouseUp={onFeaturedMouseUp}
                onMouseLeave={onFeaturedMouseUp}
                className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1 cursor-grab"
                role="list"
              >
              {featured.map((bev, i) => (
                <button
                  key={bev.id}
                  role="listitem"
                  onClick={() => setSelected(bev)}
                  aria-label={`${bev.name} — ${fmtUSD(bev.price)}. Featured drink.`}
                  className="flex-shrink-0 w-44 rounded-2xl border border-gold-500/25 bg-card hover:border-gold-400/45 overflow-hidden text-left transition-all active:scale-95 shadow-card animate-fade-up"
                  style={{ animationDelay: `${0.12 + i * 0.05}s` }}
                >
                  <div className="h-20 flex items-center justify-center bg-gradient-to-b from-gold-700/12 to-card relative overflow-hidden">
                    <div className="absolute inset-0 bg-gold-glow" />
                    <BeverageImage
                      imageUrl={bev.imageUrl}
                      emoji={bev.emoji}
                      name={bev.name}
                      emojiClassName="text-4xl"
                    />
                    {/* In-cart badge on featured cards */}
                    {(cartQuantityMap.get(bev.id) ?? 0) > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-felt-500/90 rounded-full px-1.5 py-0.5">
                        <span className="text-[9px] font-mono font-bold text-white">
                          {cartQuantityMap.get(bev.id)} in order
                        </span>
                      </div>
                    )}
                    {bev.isSignature && (
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-void/60 rounded-full px-1.5 py-0.5">
                        <Star size={8} className="text-gold-400 fill-gold-400" />
                        <span className="text-[8px] font-mono text-gold-400">Signature</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="font-display font-semibold text-gold-200 text-sm leading-tight">{bev.name}</p>
                    <p className="text-mist-500 text-[10px] font-body mt-0.5 line-clamp-1">{bev.tagline}</p>
                    <p className="text-gold-400 text-xs font-mono font-semibold mt-1.5">{fmtUSD(bev.price)}</p>
                  </div>
                </button>
              ))}
              </div>

              {/* Right fade — primary signal that more recommendation cards exist off-screen */}
              <div
                aria-hidden
                className="absolute right-0 inset-y-0 w-16 z-10 pointer-events-none transition-opacity duration-300 bg-gradient-to-l from-base/95 to-transparent"
                style={{ opacity: featuredAtEnd ? 0 : 1 }}
              />
            </div>
          </section>
        )}

        {/* ── CATEGORY NAVIGATION ── */}
        <CategoryNav
          tabs={tabs}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* ── BEVERAGE GRID ── */}
        <section
          className="px-4 pt-5"
          aria-label={`${CATEGORY_META[activeCategory].label} — ${menuDrinks.length} items`}
        >
          {menuDrinks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {menuDrinks.map((bev, i) => (
                <BeverageCard
                  key={bev.id}
                  beverage={bev}
                  onClick={setSelected}
                  onQuickAdd={handleQuickAdd}
                  cartQuantity={cartQuantityMap.get(bev.id) ?? 0}
                  style={{ animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-4xl mb-3" aria-hidden>🍹</p>
              <p className="text-mist-500 font-body text-sm">No items available right now</p>
            </div>
          )}
        </section>

        <div className="h-8" />
      </div>

      {/* ── BEVERAGE MODAL ── */}
      <BeverageModal
        beverage={selectedBeverage}
        onClose={() => setSelected(null)}
        onOrder={handleAddToOrder}
      />

      {/* ── MY ORDERS PANEL ── */}
      {showOrders && (
        <MyOrdersPanel
          orders={sessionOrders}
          onClose={() => setShowOrders(false)}
          cooldownMs={cooldownMs}
          onReorder={handleReorder}
        />
      )}

      {/* ── ORDER REVIEW MODAL ── */}
      {showReview && (
        <OrderReviewModal
          cart={cart}
          locationName={location.name}
          isSubmitting={placingOrder}
          onConfirm={handleConfirmOrder}
          onClose={() => setShowReview(false)}
          onRemoveItem={removeFromCart}
          onUpdateQty={updateCartQty}
        />
      )}

      {/* ── STICKY CART BAR ── */}
      {cartCount > 0 && !showReview && (
        <div className="fixed bottom-0 inset-x-0 z-30 pb-safe bg-base/95 backdrop-blur-xl border-t border-edge shadow-cart animate-fade-up">
          <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
            <button
              onClick={handleOpenReview}
              aria-label={`Review order — ${cartCount} items, ${fmtUSD(cartTotal)}`}
              className="w-full flex items-center justify-between bg-felt-grad rounded-2xl px-5 py-4 shadow-btn-felt hover:brightness-110 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center font-mono font-bold text-white text-sm flex-shrink-0">
                  {cartCount}
                </span>
                <div className="text-left">
                  <p className="font-body font-bold text-white text-base leading-none">
                    Review &amp; Place Order
                  </p>
                  <p className="text-white/60 text-xs font-mono mt-0.5">
                    {cartCount} item{cartCount !== 1 ? "s" : ""} · {fmtUSD(cartTotal)}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-white/70 flex-shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-50",
            "flex items-center gap-2 bg-felt-600 border border-felt-400/30",
            "rounded-2xl px-4 py-2.5 shadow-felt-glow",
            "text-white text-sm font-body font-semibold",
            "animate-toast-up whitespace-nowrap",
            cartCount > 0 ? "bottom-24" : "bottom-8",
          )}
        >
          <Check size={14} />
          {toast}
        </div>
      )}
    </main>
  );
}
