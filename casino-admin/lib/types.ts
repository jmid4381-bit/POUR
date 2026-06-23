// ─── Enumerations ─────────────────────────────────────────────────────────────

export type BeverageCategory =
  | "cocktail" | "champagne" | "spirit"
  | "wine"     | "beer"      | "shot"  | "non-alcoholic";

export type OrderStatus =
  | "pending" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";

// ─── Beverage ─────────────────────────────────────────────────────────────────

export interface Beverage {
  id:          string;
  name:        string;
  tagline?:    string;
  description: string;
  ingredients?:string[];
  category:    BeverageCategory;
  emoji:       string;
  imageUrl?:   string | null;    // photo, when set — falls back to emoji when null
  price:       number;           // USD — e.g. 18.00
  isAlcoholic: boolean;
  isAvailable: boolean;
  isFeatured:  boolean;
  isSignature?:boolean;
  isVip?:      boolean;
  prepMinutes: number;
  tags:        string[];
  pairsWith?:  string | null;
  ordersTotal: number;           // derived — lifetime order count (for analytics)
  createdAt:   string;
  updatedAt?:  string;
}

// ─── Order ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  beverageId:   string;
  beverageName: string;
  unitPrice:    number;
  quantity:     number;
  note?:        string;
}

export interface Order {
  id:           string;
  guestName?:   string;
  locationName: string;
  section:      string;
  floor:        number;
  items:        OrderItem[];
  status:       OrderStatus;
  guestNote?:   string;
  revenue:      number;          // derived — sum of item unitPrice * quantity
  placedAt:     string;
  acceptedAt?:  string;
  readyAt?:     string;
  deliveredAt?: string;
  staffName?:   string;
  cancelReason?:string;
}

// ─── Category display ─────────────────────────────────────────────────────────

export const CATEGORY_META: Record<BeverageCategory, { label: string; emoji: string; color: string }> = {
  cocktail:        { label: "Cocktail",     emoji: "🍸", color: "text-violet-400 bg-violet-400/10 border-violet-400/20" },
  champagne:       { label: "Champagne",    emoji: "🍾", color: "text-gold-400   bg-gold-400/10   border-gold-400/20"   },
  spirit:          { label: "Spirit",       emoji: "🥃", color: "text-amber-400  bg-amber-400/10  border-amber-400/20"  },
  wine:            { label: "Wine",         emoji: "🍷", color: "text-rose-400   bg-rose-400/10   border-rose-400/20"   },
  beer:            { label: "Beer",         emoji: "🍺", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  shot:            { label: "Shot",         emoji: "⚡",  color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  "non-alcoholic": { label: "Non-Alc",      emoji: "💧", color: "text-sky-400    bg-sky-400/10    border-sky-400/20"    },
};

export const ALL_CATEGORIES: BeverageCategory[] = [
  "cocktail", "champagne", "spirit", "wine", "beer", "shot", "non-alcoholic",
];

// ─── Status display ───────────────────────────────────────────────────────────

export const STATUS_META: Record<OrderStatus, { label: string; color: string; dot: string }> = {
  pending:   { label: "Pending",   color: "text-amber-400  bg-amber-400/10  border-amber-400/20",  dot: "bg-amber-400"  },
  accepted:  { label: "Accepted",  color: "text-blue-400   bg-blue-400/10   border-blue-400/20",   dot: "bg-blue-400"   },
  preparing: { label: "Preparing", color: "text-violet-400 bg-violet-400/10 border-violet-400/20", dot: "bg-violet-400" },
  ready:     { label: "Ready",     color: "text-sky-400    bg-sky-400/10    border-sky-400/20",    dot: "bg-sky-400"    },
  delivered: { label: "Delivered", color: "text-felt-400   bg-felt-400/10   border-felt-400/20",   dot: "bg-felt-400"   },
  cancelled: { label: "Cancelled", color: "text-ink-400    bg-ink-400/10    border-ink-400/20",    dot: "bg-ink-400"    },
};
