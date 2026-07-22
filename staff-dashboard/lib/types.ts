// ─── Order Status ─────────────────────────────────────────────────────────────

export type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface OrderItem {
  name: string;
  qty: number;
  note?: string;
}

export interface StaffOrder {
  id: string;
  locationId?: string;
  guestId?: string;
  guestName?: string;
  locationName: string;
  section: string;
  floor: number;
  items: OrderItem[];
  guestNote?: string;
  status: OrderStatus;
  isPriority: boolean;
  placedAt: string;
  acceptedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  staffName?: string;
  cancelReason?: string;  // Fix 7 — cancellations now capture reason
}

// ─── Urgency levels — Fix 5 graduated warning ────────────────────────────────

export type UrgencyLevel = "fresh" | "caution" | "urgent" | "overdue";

export function getUrgency(placedAt: string, status: OrderStatus): UrgencyLevel {
  if (status !== "pending") return "fresh";
  const mins = (Date.now() - new Date(placedAt).getTime()) / 60_000;
  if (mins >= OVERDUE_THRESHOLD_MINUTES) return "overdue";
  if (mins >= 8)  return "urgent";
  if (mins >= 5)  return "caution";
  return "fresh";
}

export const URGENCY_CLASSES: Record<UrgencyLevel, { text: string; bg: string; border: string; animate: string }> = {
  fresh:   { text: "text-slate-300",   bg: "",                      border: "",                         animate: ""               },
  caution: { text: "text-amber-400",   bg: "bg-amber-400/8",        border: "border-amber-400/20",      animate: ""               },
  urgent:  { text: "text-orange-400",  bg: "bg-orange-400/10",      border: "border-orange-400/25",     animate: ""               },
  overdue: { text: "text-red-400",     bg: "bg-red-400/10",         border: "border-red-400/25",        animate: "animate-blink"  },
};

// ─── Zone config — Fix 10 location scannability ──────────────────────────────

export interface ZoneMeta { short: string; color: string; bg: string; border: string }

export const ZONE_CONFIG: Record<string, ZoneMeta> = {
  "VIP Level":          { short: "VIP",    color: "text-gold-400",    bg: "bg-gold-400/12",    border: "border-gold-400/25"    },
  "Main Slots Floor":   { short: "SLOTS",  color: "text-sky-400",     bg: "bg-sky-400/10",     border: "border-sky-400/20"     },
  "Table Games East":   { short: "TABLE E",color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20"    },
  "Table Games West":   { short: "TABLE W",color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20"    },
  "High Stakes Poker":  { short: "POKER",  color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/20"     },
  "Sports Bar":         { short: "BAR",    color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
};

export function getZone(section: string): ZoneMeta {
  return ZONE_CONFIG[section] ?? { short: section.substring(0,5).toUpperCase(), color: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20" };
}

// ─── Status display config ────────────────────────────────────────────────────

export const STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; bg: string; border: string; glow: string }
> = {
  pending:   { label: "New",       color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",   glow: "shadow-pending-glow"  },
  accepted:  { label: "Preparing", color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20",    glow: "shadow-active-glow"   },
  preparing: { label: "Preparing", color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20",    glow: "shadow-active-glow"   },
  ready:     { label: "Ready",     color: "text-violet-400",  bg: "bg-violet-400/10",  border: "border-violet-400/20",  glow: "shadow-ready-glow"    },
  delivered: { label: "Delivered", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", glow: "shadow-delivered-glow"},
  cancelled: { label: "Cancelled", color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/20",   glow: ""                     },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

export const OVERDUE_THRESHOLD_MINUTES = 10;
