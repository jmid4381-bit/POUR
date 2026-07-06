"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ShoppingBag, Star, Sparkles, ChevronRight, Check, Clock, Building2,
} from "lucide-react";
import { BeverageCard }      from "@/components/BeverageCard";
import { BrandCard }        from "@/components/BrandCard";
import { BeverageImage }     from "@/components/BeverageImage";
import { BeverageModal }     from "@/components/BeverageModal";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { OrderReviewModal }  from "@/components/OrderReviewModal";
import { MyOrdersPanel }     from "@/components/MyOrdersPanel";
import { ReorderConfirmDialog } from "@/components/ReorderConfirmDialog";
import { July4MilestoneOverlay } from "@/components/July4MilestoneOverlay";
import { useJuly4Milestones } from "@/hooks/useJuly4Milestones";
import { useJuly4EventSettings } from "@/hooks/useJuly4EventSettings";
import { AgeGate, AgeGateDeclined, hasVerifiedAge, hasDeclinedAge, getAgeVerificationMeta, isUnderageSession, getGuestName } from "@/components/AgeGate";
import { CategoryNav, type CategoryTab } from "@/components/CategoryNav";
import { useMenu }           from "@/hooks/useMenu";
import { useCart }           from "@/hooks/useCart";
import { useOrderHistory } from "@/hooks/useOrderHistory";
import {
  submitOrder, calculateETA, getQueueDepth, readAlcoholCooldownMs, readAlcoholRoom,
  type QueuedOrder,
} from "@/lib/queue";
import {
  MENU_CATEGORIES, CATEGORY_META,
  type Beverage, type BeverageCategory, type PlacedOrder, type CartItem,
} from "@/lib/data";
import { cn, fmtUSD, generateOrderId } from "@/lib/utils";
import { HOLIDAY_THEME_ACTIVE } from "@/lib/config";
import { getOrCreateGuestId } from "@/lib/guestSession";
import { fetchGuestOrderHistory } from "@/lib/guestOrderHistory";

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
  // Separate from `toast` — these are the passive status notifications
  // (cooldown cleared, staff assigned, order ready), which need to be hard
  // to miss while a guest is scrolling the menu, unlike the small bottom
  // confirmations like "added to your order".
  const [bigToast,         setBigToast]    = useState<string | null>(null);
  // Full-attention cooldown blocker — shown when a guest tries to add an
  // alcoholic drink while their cooldown is still active.
  const [cooldownBlocked,  setCooldownBlocked] = useState(false);

  // Session order history — persisted in sessionStorage, polled for live status
  const { orders: sessionOrders, addOrder, restoreOrders, clearOrders, activeCount, refreshNow } = useOrderHistory(locationId);

  // Restore a returning guest's order history (any location, last 24h) from
  // Supabase by their persistent guest-ID cookie — the same identifier and
  // window already used for the alcohol cooldown check. Runs once the menu
  // has loaded (beverages are needed to re-attach emoji/category for
  // display); a brand-new guest's cookie just won't match any rows, so this
  // is a no-op for them.
  const historyRestored = useRef(false);
  useEffect(() => {
    if (historyRestored.current) return;
    const gid = guestIdRef.current;
    if (!gid || beverages.length === 0) return;
    historyRestored.current = true;
    fetchGuestOrderHistory(gid, beverages).then(restoreOrders);
  }, [beverages, restoreOrders]);

  // Furthest-along active order — drives the persistent header status label.
  // Same step ranking/wording as the My Orders panel's progress tracker.
  const ACTIVE_STEPS = ["Received", "Preparing…", "On the way"];
  const orderStep = (status: string) =>
    status === "ready" ? 2 : (status === "accepted" || status === "preparing") ? 1 : 0;
  const furthestActiveOrder = sessionOrders
    .filter(o => o.status !== "delivered" && o.status !== "cancelled")
    .sort((a, b) => orderStep(b.status) - orderStep(a.status))[0];
  const headerStatusLabel = furthestActiveOrder ? ACTIVE_STEPS[orderStep(furthestActiveOrder.status)] : null;

  // Toast when the cooldown clears — fires exactly once on the >0 → 0
  // transition, never on a render that's already at 0.
  const prevCooldownMs = useRef(0);
  useEffect(() => {
    if (prevCooldownMs.current > 0 && cooldownMs === 0) {
      setBigToast("You can now order another drink!");
      setTimeout(() => setBigToast(null), 3500);
    }
    prevCooldownMs.current = cooldownMs;
  }, [cooldownMs]);

  // Toast on meaningful order-status transitions — staff first assigned, or
  // status first reaching "ready" — each fires once per order via a
  // last-seen snapshot, not on every 5s poll tick.
  //
  // The snapshot only lives in memory (a ref), so it's empty again after any
  // page refresh — with no prior record, an order that already has a staff
  // name or is already "ready" would otherwise look like a fresh transition
  // and re-fire the toast. Requiring `prev` to actually exist before firing
  // means the first observation of any order this page load just seeds the
  // snapshot silently instead of treating it as a change.
  const orderSnapshotRef = useRef<Map<string, { status: string; staffName?: string }>>(new Map());
  useEffect(() => {
    for (const o of sessionOrders) {
      const prev = orderSnapshotRef.current.get(o.id);
      if (prev && o.staffName && !prev.staffName) {
        setBigToast(`${o.staffName} is preparing your order`);
        setTimeout(() => setBigToast(null), 3000);
      } else if (prev && o.status === "ready" && prev.status !== "ready") {
        setBigToast(o.staffName ? `${o.staffName} is bringing your order!` : "Your order is on the way!");
        setTimeout(() => setBigToast(null), 3000);
      }
      orderSnapshotRef.current.set(o.id, { status: o.status, staffName: o.staffName });
    }
  }, [sessionOrders]);

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

  // Tracks the auto-dismiss timer for the cooldown blocker banner so every
  // new attempt resets the countdown instead of being silently swallowed.
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-open summary: the review sheet slides up on the first successful add
  // of a session. Once the guest closes it, we stop auto-opening for the rest
  // of the session (bottom bar takes over) — reset when a new order starts.
  const autoReviewDismissed = useRef(false);
  // Set when an add came from the BeverageModal — defer opening the sheet until
  // the modal has finished closing so two panels never overlap.
  const pendingAutoOpen = useRef(false);

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

  // Group drinks that share a brand into a single card (e.g. White Claw flavors, Truly flavors).
  // Returns an ordered list of either a single Beverage (rendered as BeverageCard) or a brand
  // group (rendered as BrandCard). Order is preserved — first beverage of each group sets position.
  const BRAND_PREFIXES = ["White Claw Tails", "BuzzBallz", "Mom Water", "Smirnoff Ice Icy Island"] as const;
  type BrandGroup = { kind: "brand"; brand: string; emoji: string; beverages: Beverage[] };
  type SingleItem = { kind: "single"; beverage: Beverage };
  const menuItems = useMemo((): (BrandGroup | SingleItem)[] => {
    const seen = new Set<string>();
    const result: (BrandGroup | SingleItem)[] = [];
    for (const bev of menuDrinks) {
      const brand = BRAND_PREFIXES.find(p => bev.name.startsWith(p + " ") || bev.name === p);
      if (brand) {
        if (!seen.has(brand)) {
          seen.add(brand);
          result.push({
            kind: "brand",
            brand,
            emoji: bev.emoji,
            beverages: menuDrinks.filter(b => b.name.startsWith(brand + " ") || b.name === brand),
          });
        }
      } else {
        result.push({ kind: "single", beverage: bev });
      }
    }
    return result;
  }, [menuDrinks]);

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

  const handleAddToOrder = useCallback((beverage: Beverage, qty: number, note: string, size: "regular" | "giant" = "regular") => {
    // Any active cooldown blocks ALL alcoholic adds — show the countdown banner
    if (beverage.isAlcoholic && cooldownMs > 0) {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      setCooldownBlocked(false);
      requestAnimationFrame(() => {
        setCooldownBlocked(true);
        cooldownTimerRef.current = setTimeout(() => setCooldownBlocked(false), 5000);
      });
      return;
    }

    // Was this add triggered from inside the BeverageModal (vs a card quick-add)?
    const fromModal = selectedBeverage !== null;
    const { added, capped } = addItem(beverage, qty, note, size);

    if (added === 0) {
      // Nothing added (drink limit) — this is a block, not a confirm: no auto-open
      setToast("Drink limit reached — try again shortly");
      setTimeout(() => setToast(null), 3500);
      return;
    }

    // A real add happened. Show the cap toast if partial; otherwise only show
    // the small "added" toast when auto-open is off (the sheet is the confirm).
    if (capped) {
      setToast(`Added ${added} — drink limit reached for now`);
      setTimeout(() => setToast(null), 3500);
    } else if (autoReviewDismissed.current) {
      setToast(`${beverage.name} added`);
      setTimeout(() => setToast(null), 3500);
    }

    // Auto-open the summary sheet the first time this session.
    if (!autoReviewDismissed.current) {
      if (fromModal) pendingAutoOpen.current = true; // opens once the modal closes
      else           setShowReview(true);
    }
  }, [addItem, cooldownMs, selectedBeverage]);

  // Slide the summary sheet up only after the BeverageModal has fully closed,
  // so the two panels never overlap during the modal's confirm animation.
  useEffect(() => {
    if (selectedBeverage === null && pendingAutoOpen.current) {
      pendingAutoOpen.current = false;
      setShowReview(true);
    }
  }, [selectedBeverage]);

  // Close the review sheet automatically once the cart is emptied — whether the
  // last item was removed via the trash button or decremented to zero. No point
  // showing an empty "0 drinks" summary.
  useEffect(() => {
    if (showReview && cart.length === 0) setShowReview(false);
  }, [cart.length, showReview]);

  const handleQuickAdd = useCallback((beverage: Beverage, size: "regular" | "giant" = "regular") => {
    handleAddToOrder(beverage, 1, "", size);
  }, [handleAddToOrder]);

  // If an admin marks a drink unavailable while a guest has its detail modal
  // open, close the modal gracefully and tell them — rather than leaving them
  // staring at (and able to add) a drink that no longer exists. The live menu
  // arrives via useMenu's Realtime/poll sync, so we just react to `beverages`.
  useEffect(() => {
    if (!selectedBeverage) return;
    const live = beverages.find(b => b.id === selectedBeverage.id);
    if (!live || !live.isAvailable) {
      setSelected(null);
      setToast("This drink is no longer available");
      setTimeout(() => setToast(null), 3500);
    }
  }, [beverages, selectedBeverage]);

  const removeFromCart = useCallback((beverageId: string) => {
    removeItem(beverageId);
    // Sheet auto-closes on empty cart via the effect above.
  }, [removeItem]);

  const updateCartQty = useCallback((beverageId: string, delta: number) => {
    updateQty(beverageId, delta);
  }, [updateQty]);

  const handleOpenReview = useCallback(() => {
    if (cart.length === 0) return;
    setShowReview(true);
  }, [cart.length]);

  // Core submission pipeline — shared by the normal cart checkout and by
  // Reorder (which places a standalone order from a past order's items
  // without ever touching the visible cart). Server-side validation in
  // /api/orders is the real authority on availability and the alcohol
  // cooldown either way; this just wires its result back into the UI.
  const placeOrder = useCallback(async (items: CartItem[]): Promise<boolean> => {
    if (items.length === 0 || isConfirming.current || !location) return false;
    isConfirming.current = true;
    setPlacingOrder(true);

    // ETA accounts for how busy the bar currently is
    const queueDepth       = await getQueueDepth();
    const estimatedMinutes = calculateETA(items, queueDepth);

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
      items:            [...items],
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
      return false;
    }

    if (result.cooldownBlocked) {
      setPlacingOrder(false);
      isConfirming.current = false;
      setCooldownMs(result.cooldownMs ?? 0);
      const mins = Math.max(1, Math.ceil((result.cooldownMs ?? 0) / 60_000));
      setToast(`Drink limit reached — try again in ${mins} minute${mins !== 1 ? "s" : ""}`);
      setTimeout(() => setToast(null), 3500);
      return false;
    }

    if (result.giantUnavailable) {
      setPlacingOrder(false);
      isConfirming.current = false;
      setToast("Giant cups are no longer available — please order Regular instead");
      setTimeout(() => setToast(null), 4000);
      return false;
    }

    await new Promise(r => setTimeout(r, 900));

    const placed: PlacedOrder = {
      id: orderId,
      locationName:     location.name,
      items:            [...items],
      estimatedMinutes,
      placedAt:         now,
      surchargeAmount:  result.surchargeAmount ?? 0,
      surchargeLabel:   result.surchargeLabel ?? null,
    };

    // Save to session history before switching to confirmation screen
    addOrder({
      id:               orderId,
      locationName:     location.name,
      items:            [...items],
      estimatedMinutes,
      placedAt:         now,
      surchargeAmount:  result.surchargeAmount ?? 0,
      surchargeLabel:   result.surchargeLabel ?? null,
    });

    // Save scroll position before switching to confirmation screen
    savedScrollY.current   = window.scrollY;
    savedCategory.current  = activeCategory;

    // Record alcoholic drinks just placed so the 10-minute window correctly
    // limits how much more can be ordered this session
    const alcoholicQty = items.reduce((s, i) => i.beverage.isAlcoholic ? s + i.quantity : s, 0);
    recordAlcoholicOrder(alcoholicQty);
    if (alcoholicQty > 0) refreshCooldown();

    setPlacingOrder(false);
    setPlacedOrder(placed);
    isConfirming.current = false;
    return true;
  }, [location, locationId, activeCategory, addOrder, recordAlcoholicOrder, refreshCooldown]);

  const handleConfirmOrder = useCallback(async () => {
    if (cart.length === 0) return;
    const placed = await placeOrder(cart);
    if (placed) {
      clearItems();
      setShowReview(false);
      autoReviewDismissed.current = false; // next order is a fresh session
    }
  }, [cart, placeOrder, clearItems]);

  // ── Reorder — re-place a past order's items as a standalone new order,
  // bypassing the cart entirely. Items are re-resolved against the live
  // menu (current price/availability) before the confirm dialog is shown.
  //
  // The alcoholic portion is trimmed to the guest's actual remaining room
  // (queried fresh, not the binary cooldownMs flag) BEFORE submission —
  // submitting the whole mixed order as one request would otherwise let
  // the server reject it entirely over the alcoholic items alone, which
  // would incorrectly block the non-alcoholic items in the same order.
  const [reorderCandidate, setReorderCandidate] = useState<CartItem[] | null>(null);
  const [reorderNote,      setReorderNote]      = useState<string | null>(null);
  // How many more alcoholic drinks could still be added to this reorder
  // without exceeding the guest's real cooldown room — computed once when
  // the dialog opens, then adjusted live as the guest taps +/- on an
  // alcoholic item so the limit can never be exceeded from this dialog.
  const [reorderRoomLeft, setReorderRoomLeft]  = useState(0);

  const handleReorder = useCallback(async (order: { items: CartItem[] }) => {
    const nonAlcoholic: CartItem[] = [];
    const alcoholic:    CartItem[] = [];
    let unavailableCount = 0;

    for (const item of order.items) {
      const live = beverages.find(b => b.id === item.beverage.id);
      if (!live || !live.isAvailable) { unavailableCount++; continue; }
      (live.isAlcoholic ? alcoholic : nonAlcoholic).push({ beverage: live, quantity: item.quantity, note: item.note, size: item.size });
    }

    let droppedAlcoholicQty = 0;
    let leftoverRoom = 0;
    if (alcoholic.length > 0) {
      const gid  = guestIdRef.current ?? getOrCreateGuestId();
      let room   = await readAlcoholRoom(gid);
      const kept: CartItem[] = [];
      for (const item of alcoholic) {
        const take = Math.min(item.quantity, room);
        if (take > 0) kept.push({ ...item, quantity: take });
        droppedAlcoholicQty += item.quantity - take;
        room -= take;
      }
      alcoholic.length = 0;
      alcoholic.push(...kept);
      leftoverRoom = room;
    }

    const resolved = [...nonAlcoholic, ...alcoholic];

    if (resolved.length === 0) {
      setToast(droppedAlcoholicQty > 0
        ? "Drink limit reached for now — try again shortly"
        : "Those items are no longer available");
      setTimeout(() => setToast(null), 3500);
      return;
    }

    const notes: string[] = [];
    if (droppedAlcoholicQty > 0) notes.push(`${droppedAlcoholicQty} alcoholic drink${droppedAlcoholicQty !== 1 ? "s" : ""} skipped — limit reached for now`);
    if (unavailableCount   > 0) notes.push(`${unavailableCount} item${unavailableCount !== 1 ? "s" : ""} no longer available`);
    setReorderNote(notes.join(" · ") || null);
    setReorderRoomLeft(leftoverRoom);
    setReorderCandidate(resolved);
  }, [beverages]);

  // Lets the guest bump quantities up/down right in the confirm dialog
  // instead of re-placing the same reorder multiple times. Alcoholic items
  // are still capped by the guest's real remaining cooldown room; non-
  // alcoholic items just respect the same 8-per-item ceiling the cart uses.
  const updateReorderQty = useCallback((beverageId: string, delta: number) => {
    setReorderCandidate(prev => {
      if (!prev) return prev;
      return prev.map(item => {
        if (item.beverage.id !== beverageId) return item;
        if (delta > 0) {
          if (item.beverage.isAlcoholic) {
            if (reorderRoomLeft <= 0) return item;
            setReorderRoomLeft(r => Math.max(0, r - 1));
          }
          const nextQty = Math.min(8, item.quantity + 1);
          return nextQty === item.quantity ? item : { ...item, quantity: nextQty };
        } else {
          if (item.quantity <= 1) return item;
          if (item.beverage.isAlcoholic) setReorderRoomLeft(r => r + 1);
          return { ...item, quantity: item.quantity - 1 };
        }
      });
    });
  }, [reorderRoomLeft]);

  const updateReorderSize = useCallback((beverageId: string, size: "regular" | "giant") => {
    setReorderCandidate(prev => {
      if (!prev) return prev;
      return prev.map(item =>
        item.beverage.id === beverageId ? { ...item, size } : item
      );
    });
  }, []);

  const confirmReorder = useCallback(async () => {
    if (!reorderCandidate) return;
    const placed = await placeOrder(reorderCandidate);
    setReorderCandidate(null);
    setReorderNote(null);
    setReorderRoomLeft(0);
    if (placed) setShowOrders(false);
  }, [reorderCandidate, placeOrder]);

  const cancelReorder = useCallback(() => {
    setReorderCandidate(null);
    setReorderNote(null);
    setReorderRoomLeft(0);
  }, []);

  // Restore category and scroll position when returning from confirmation
  const handleOrderMore = useCallback(() => {
    setPlacedOrder(null);
    autoReviewDismissed.current = false; // returning to browse — fresh session
    setActiveCategory(savedCategory.current);
    // Restore scroll after DOM has updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollY.current, behavior: "instant" });
      });
    });
  }, []);

  // Any active modal/checkout flow — used both to lock body scroll and to
  // hold off the July 4th milestone overlay so it never interrupts an
  // active checkout action.
  const anyModalOpen = showReview || showOrders || !!selectedBeverage || !!reorderCandidate;

  // Called once here (not inside the overlay component) so its "already
  // fired" tracking survives the menu <-> confirmation screen transition —
  // those are two separate conditional returns below, and a hook called
  // inside a component that gets unmounted/remounted on that switch would
  // otherwise reset and replay milestones that already happened.
  const july4Milestone = useJuly4Milestones(anyModalOpen);
  const { giantCupsAvailable, venueName } = useJuly4EventSettings();

  // Multi-tenant: reflect the venue name in the browser tab too, once it's
  // loaded from event_settings (falls back to the static default until then).
  useEffect(() => {
    document.title = `Order Beverages — ${venueName}`;
  }, [venueName]);

  // Lock body scroll when any overlay is open
  useEffect(() => {
    document.body.classList.toggle("modal-open", anyModalOpen);
    return () => document.body.classList.remove("modal-open");
  }, [anyModalOpen]);

  // ── Render gates ───────────────────────────────────────────────────────────

  // Age gate (SSR-safe: "checking" shows nothing until client hydrates)
  if (ageState === "checking") {
    return (
      <AgeGate
        onConfirm={() => { setIsUnderage(isUnderageSession()); setGuestDisplayName(getGuestName()); setAgeState("verified"); }}
        onDecline={() => setAgeState("declined")}
        onResetIdentity={() => {
          // "Not me" already minted a fresh guest-ID cookie — pick it up
          // here too so cooldown reads and order placement use the new
          // identity, and drop the previous guest's restored history so
          // it doesn't carry over to whoever's actually using the device
          // now. Re-fetches under the new ID in case it somehow matches
          // existing rows (e.g. a UUID collision) — in practice this will
          // just come back empty for a genuinely new identity.
          const newGid = getOrCreateGuestId();
          guestIdRef.current = newGid;
          clearOrders();
          if (beverages.length > 0) {
            fetchGuestOrderHistory(newGid, beverages).then(restoreOrders);
          }
        }}
      />
    );
  }
  if (ageState === "declined") {
    return <AgeGateDeclined />;
  }

  if (placedOrder) {
    return (
      <>
        <OrderConfirmation
          key={placedOrder.id}
          order={placedOrder}
          onOrderMore={handleOrderMore}
          onReorder={() => handleReorder(placedOrder)}
          onViewOrders={() => setShowOrders(true)}
        />
        {showOrders && (
          <MyOrdersPanel
            orders={sessionOrders}
            onClose={() => setShowOrders(false)}
            cooldownMs={cooldownMs}
            onReorder={handleReorder}
          />
        )}
        {reorderCandidate && (
          <ReorderConfirmDialog
            items={reorderCandidate}
            note={reorderNote}
            alcoholRoomLeft={reorderRoomLeft}
            onUpdateQty={updateReorderQty}
            onUpdateSize={updateReorderSize}
            giantCupsAvailable={giantCupsAvailable}
            onConfirm={confirmReorder}
            onCancel={cancelReorder}
            isPlacing={placingOrder}
          />
        )}
        <July4MilestoneOverlay display={july4Milestone} />
      </>
    );
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
      {HOLIDAY_THEME_ACTIVE ? (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(29,78,216,0.35), transparent), radial-gradient(ellipse 70% 35% at 10% 100%, rgba(185,28,28,0.3), transparent), radial-gradient(ellipse 70% 35% at 90% 100%, rgba(185,28,28,0.25), transparent)" }}
        />
      ) : (
        <div className="fixed inset-0 pointer-events-none bg-hero-glow" />
      )}

      <div className="relative z-10 max-w-lg mx-auto">

        {/* ── STICKY HEADER ── */}
        <header className={cn(
          "sticky top-0 z-30 bg-base/92 backdrop-blur-xl",
          HOLIDAY_THEME_ACTIVE ? "border-b border-transparent" : "border-b border-edge",
        )}>
          <div className="px-4 h-14 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-bold leading-none truncate bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                POUR
              </p>
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
                  className="relative h-10 pl-3 pr-3.5 rounded-xl bg-lift border border-rim flex items-center gap-1.5 text-mist-200 hover:border-gold-600/50 transition-colors"
                >
                  {/* Pulsing live dot — only while something is actually active */}
                  {headerStatusLabel && (
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                      <span className="animate-pulse-dot absolute h-full w-full rounded-full bg-gold-400 opacity-75" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-gold-500 inline-flex" />
                    </span>
                  )}
                  {/* Receipt icon — three lines */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
                    <path d="M16 8H8M16 12H8M12 16H8"/>
                  </svg>
                  {/* Label swaps to the live order status while one's active —
                      key={headerStatusLabel} remounts the span on change so
                      the pop animation replays, catching the eye even out of
                      the corner of the guest's vision while browsing */}
                  <span key={headerStatusLabel ?? "orders"} className="text-xs font-body font-semibold animate-scale-in whitespace-nowrap">
                    {headerStatusLabel ?? "Orders"}
                  </span>
                  {/* Active order count badge — only when more than one, since
                      the status label already conveys "something's active" */}
                  {activeCount > 1 && (
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

        {/* ── Prominent passive status notification — cooldown cleared, staff
              assigned, order ready. Pinned just under the header so it's hard
              to miss even mid-scroll, unlike the small bottom toast used for
              quick action confirmations. ── */}
        {bigToast && (
          <div className="sticky top-14 z-40 px-4 pt-3 pointer-events-none animate-fade-up">
            <div className="flex items-center gap-3 bg-gold-grad rounded-2xl px-4 py-3.5 shadow-[0_8px_32px_rgba(201,160,48,0.35)] animate-scale-in">
              <div className="w-8 h-8 bg-void/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-void" strokeWidth={2.5} />
              </div>
              <p className="text-void font-body font-bold text-sm leading-tight">{bigToast}</p>
            </div>
          </div>
        )}

        {/* Cooldown blocker — fires when a guest tries to add an alcoholic
            drink while their limit is still active. Sticky under the header
            so it's impossible to miss; shows the live countdown. */}
        {cooldownBlocked && cooldownMs > 0 && (
          <div className="sticky top-14 z-40 px-4 pt-3 pointer-events-none animate-fade-up">
            <div className="flex items-center gap-3 bg-red-600/95 rounded-2xl px-4 py-3.5 shadow-[0_8px_32px_rgba(220,38,38,0.45)] animate-scale-in">
              <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white font-body font-bold text-sm leading-tight">Drink limit reached</p>
                <p className="text-white/80 font-mono text-xs mt-0.5">
                  {formatCooldown(cooldownMs)} until your next alcoholic drink
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── LOCATION BANNER ── */}
        <div className="px-4 pt-8 pb-6 text-center">
          {guestDisplayName && (
            <p className="text-mist-400 text-sm font-body mb-1.5 animate-fade-up">
              Welcome, {guestDisplayName}
            </p>
          )}
          {HOLIDAY_THEME_ACTIVE ? (
            <h1 className="font-display text-[2.6rem] font-semibold leading-tight mb-2 animate-fade-up">
              <span className="bg-gradient-to-r from-red-400 via-mist-50 to-blue-400 bg-clip-text text-transparent">
                Happy 4th of July
              </span>
            </h1>
          ) : (
            <h1 className="font-display text-[2.6rem] font-semibold text-white leading-tight mb-2 animate-fade-up">
              {location.name}
            </h1>
          )}
          {/* Venue name — multi-tenant branding, sourced from event_settings.
              (The hero above already shows the specific location; this line
              identifies which venue/property this deployment belongs to.) */}
          <div className="flex items-start justify-center gap-1.5 text-mist-400 animate-fade-up max-w-[92%] mx-auto" style={{ animationDelay:"0.05s" }}>
            <Building2 size={12} className="text-felt-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-body text-center break-words">{venueName}</span>
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
          {menuItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {menuItems.map((item, i) =>
                item.kind === "brand" ? (
                  <BrandCard
                    key={item.brand}
                    brand={item.brand}
                    emoji={item.emoji}
                    beverages={item.beverages}
                    cartQuantityMap={cartQuantityMap}
                    onClick={setSelected}
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                ) : (
                  <BeverageCard
                    key={item.beverage.id}
                    beverage={item.beverage}
                    onClick={setSelected}
                    onQuickAdd={handleQuickAdd}
                    cartQuantity={cartQuantityMap.get(item.beverage.id) ?? 0}
                    giantCupsAvailable={giantCupsAvailable}
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                )
              )}
            </div>
          ) : menuDrinks.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-4xl mb-3" aria-hidden>🍹</p>
              <p className="text-mist-500 font-body text-sm">No items available right now</p>
            </div>
          ) : null}
        </section>

        <div className="h-8" />
      </div>

      {/* ── BEVERAGE MODAL ── */}
      <BeverageModal
        beverage={selectedBeverage}
        giantCupsAvailable={giantCupsAvailable}
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

      {/* ── REORDER CONFIRMATION ── */}
      {reorderCandidate && (
        <ReorderConfirmDialog
          items={reorderCandidate}
          note={reorderNote}
          alcoholRoomLeft={reorderRoomLeft}
          onUpdateQty={updateReorderQty}
          onUpdateSize={updateReorderSize}
          giantCupsAvailable={giantCupsAvailable}
          onConfirm={confirmReorder}
          onCancel={cancelReorder}
          isPlacing={placingOrder}
        />
      )}

      {/* ── ORDER REVIEW MODAL ── */}
      {showReview && (
        <OrderReviewModal
          cart={cart}
          locationName={location.name}
          isSubmitting={placingOrder}
          onConfirm={handleConfirmOrder}
          onClose={() => { setShowReview(false); autoReviewDismissed.current = true; }}
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
      {/* Full-width centering wrapper keeps the pill within the viewport on
          narrow phones: short messages stay a compact centered pill, long ones
          wrap to multiple lines (capped at the screen width minus 16px margins)
          instead of being clipped off the edges. Verified at 375px & 390px. */}
      {toast && (
        <div
          className={cn(
            "fixed inset-x-0 z-50 px-4 flex justify-center pointer-events-none",
            cartCount > 0 ? "bottom-24" : "bottom-8",
          )}
        >
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex items-center gap-2 max-w-full",
              "bg-felt-600 border border-felt-400/30",
              "rounded-2xl px-4 py-2.5 shadow-felt-glow",
              "text-white text-sm font-body font-semibold",
              "animate-toast-up",
            )}
          >
            <Check size={14} className="flex-shrink-0" />
            <span className="min-w-0 leading-snug">{toast}</span>
          </div>
        </div>
      )}

      <July4MilestoneOverlay display={july4Milestone} />
    </main>
  );
}
