/**
 * Aksiyon: cleanup_orphan_cart — Yetim cart_items kayıtlarını sil.
 *
 * Payload:
 *   { cartItemIds: string[], reason?: string }
 *
 * Yetim cart_items:
 *   - user_id auth.users'ta yok (kullanıcı silinmiş)
 *   - veya updated_at 90+ gün önce + paid order yok
 *
 * DataHygieneAuditor tespit eder, Sefa onaylar.
 */

import type { ActionHandler } from "../_shared/proposal";

interface OrphanCartPayload {
  cartItemIds: string[];
  reason?: string;
}

const cleanupOrphanCart: ActionHandler = async ({ admin, payload }) => {
  const { cartItemIds, reason = "orphan_cleanup" } =
    payload as unknown as OrphanCartPayload;

  if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
    return {
      result: "failed",
      error: "Invalid payload: 'cartItemIds' required",
    };
  }

  const { data, error } = await admin
    .from("cart_items")
    .delete()
    .in("id", cartItemIds)
    .select("id");

  if (error) {
    return {
      result: "failed",
      error: `DB delete failed: ${error.message}`,
    };
  }

  const deleted = (data ?? []) as Array<{ id: string }>;

  return {
    result: deleted.length === cartItemIds.length ? "success" : "partial",
    affectedRows: deleted.length,
    affectedIds: { cartItemIds: deleted.map((r) => r.id) },
    externalCall: { requested: cartItemIds.length, deleted: deleted.length, reason },
  };
};

export default cleanupOrphanCart;
