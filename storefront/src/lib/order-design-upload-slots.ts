/**
 * Multi-design siparişlerde QC/prova tetikleme guard'ı.
 * Tüm tasarım slotları dolmadan cutline/proof pipeline başlamamalı.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getExpectedDesignCount } from "./order-item-meta";
import { USABLE_DESIGN_STATUSES } from "./design-file-status";

export async function orderDesignUploadSlotsComplete(
  admin: SupabaseClient,
  orderId: string
): Promise<boolean> {
  const { data: items, error: itemsErr } = await admin
    .from("order_items")
    .select("id, meta")
    .eq("order_id", orderId);

  if (itemsErr || !items || items.length === 0) {
    return false;
  }

  const { data: files, error: filesErr } = await admin
    .from("design_files")
    .select("order_item_id")
    .eq("order_id", orderId)
    .in("status", [...USABLE_DESIGN_STATUSES]);

  if (filesErr) {
    return false;
  }

  const countByItem = new Map<string, number>();
  for (const row of files ?? []) {
    const itemId = (row as { order_item_id: string | null }).order_item_id;
    if (typeof itemId === "string") {
      countByItem.set(itemId, (countByItem.get(itemId) ?? 0) + 1);
    }
  }

  for (const item of items) {
    const meta = (item as { meta: Record<string, unknown> | null }).meta;
    const required = getExpectedDesignCount(meta);
    const uploaded = countByItem.get((item as { id: string }).id) ?? 0;
    if (uploaded < required) {
      return false;
    }
  }

  return true;
}
