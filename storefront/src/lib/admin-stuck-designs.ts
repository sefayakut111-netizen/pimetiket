/**
 * Admin — takılı design_files sayımı / onarımı için ortak filtre.
 * Yalnızca aktif, gerçek siparişlere bağlı dosyalar (test + iptal hariç).
 */

import type { Json } from "@/lib/supabase/types";
import { isTestOrderLike } from "@/lib/admin-order-filters";

export const STUCK_DESIGN_CUTOFF_MS = 60 * 60 * 1000;

export type StuckDesignRow = {
  id: string;
  order_id: string;
  orders: {
    id: string;
    status: string;
    address: Json;
  } | null;
};

export function isActionableStuckDesign(row: StuckDesignRow): boolean {
  const order = row.orders;
  if (!order) return false;
  if (order.status === "cancelled") return false;
  const address =
    order.address && typeof order.address === "object" && !Array.isArray(order.address)
      ? (order.address as { name?: string })
      : null;
  return !isTestOrderLike({ id: order.id, address });
}

export function filterActionableStuckDesigns(rows: StuckDesignRow[]): StuckDesignRow[] {
  return rows.filter(isActionableStuckDesign);
}
