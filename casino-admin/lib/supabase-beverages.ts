import type { Beverage, BeverageCategory } from "./types";

// ─── Row shape as stored in Supabase ──────────────────────────────────────────

export interface BeverageRow {
  id:           string;
  name:         string;
  tagline:      string | null;
  description:  string;
  ingredients:  string[] | null;
  category:     BeverageCategory;
  emoji:        string;
  price:        number;
  is_alcoholic: boolean;
  is_available: boolean;
  is_featured:  boolean;
  is_signature: boolean;
  is_vip:       boolean;
  prep_minutes: number;
  tags:         string[] | null;
  pairs_with:   string | null;
  image_url:    string | null;
  created_at:   string;
  updated_at:   string;
}

// ─── Row → Beverage ───────────────────────────────────────────────────────────

export function rowToBeverage(row: BeverageRow, ordersTotal = 0): Beverage {
  return {
    id:          row.id,
    name:        row.name,
    tagline:     row.tagline ?? undefined,
    description: row.description,
    ingredients: row.ingredients ?? [],
    category:    row.category,
    emoji:       row.emoji,
    price:       row.price,
    isAlcoholic: row.is_alcoholic,
    isAvailable: row.is_available,
    isFeatured:  row.is_featured,
    isSignature: row.is_signature,
    isVip:       row.is_vip,
    prepMinutes: row.prep_minutes,
    tags:        row.tags ?? [],
    pairsWith:   row.pairs_with,
    imageUrl:    row.image_url,
    ordersTotal,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ─── Beverage → Row (for insert/update) ───────────────────────────────────────

export function beverageToRow(b: Omit<Beverage, "id" | "ordersTotal" | "createdAt" | "updatedAt">): Partial<BeverageRow> {
  return {
    name:         b.name,
    tagline:      b.tagline ?? null,
    description:  b.description,
    ingredients:  b.ingredients ?? [],
    category:     b.category,
    emoji:        b.emoji,
    price:        b.price,
    is_alcoholic: b.isAlcoholic,
    is_available: b.isAvailable,
    is_featured:  b.isFeatured,
    is_signature: b.isSignature ?? false,
    is_vip:       b.isVip ?? false,
    prep_minutes: b.prepMinutes,
    tags:         b.tags,
    pairs_with:   b.pairsWith ?? null,
    image_url:    b.imageUrl ?? null,
  };
}
