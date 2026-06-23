import type { OrderItem, OrderStatus, StaffOrder } from "@/lib/types";

// ─── Row shapes as stored in Supabase ─────────────────────────────────────────

export interface OrderItemRow {
  id: string;
  order_id: string;
  beverage_id: string | null;
  beverage_name: string;
  unit_price: number | null;
  quantity: number;
  note: string | null;
  created_at: string;
}

export interface OrderRow {
  id: string;
  location_id: string | null;
  guest_id: string | null;
  guest_name: string | null;
  location_name: string;
  section: string;
  floor: number;
  estimated_minutes: number | null;
  status: OrderStatus;
  guest_note: string | null;
  is_priority: boolean | null;
  placed_at: string;
  updated_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  staff_name: string | null;
  cancel_reason: string | null;
  order_items?: OrderItemRow[];
}

// ─── Row → StaffOrder ─────────────────────────────────────────────────────────

export function itemRowToOrderItem(row: OrderItemRow): OrderItem {
  return {
    name: row.beverage_name,
    qty: row.quantity,
    note: row.note ?? undefined,
  };
}

export function rowToOrder(row: OrderRow): StaffOrder {
  return {
    id: row.id,
    locationId: row.location_id ?? undefined,
    guestId: row.guest_id ?? undefined,
    guestName: row.guest_name ?? undefined,
    locationName: row.location_name,
    section: row.section,
    floor: row.floor,
    items: (row.order_items ?? []).map(itemRowToOrderItem),
    guestNote: row.guest_note ?? undefined,
    status: row.status,
    isPriority: row.is_priority ?? false,
    placedAt: row.placed_at,
    acceptedAt: row.accepted_at ?? undefined,
    readyAt: row.ready_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    staffName: row.staff_name ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
  };
}
