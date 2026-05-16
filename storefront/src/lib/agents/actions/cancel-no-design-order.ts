/**
 * Aksiyon: cancel_no_design_order — 3+ gün dosya yüklenmemiş siparişi iptal et.
 *
 * Payload:
 *   { orderIds: string[], reason?: string }
 *
 * Sefa kuralı (Mesafeli Satış m.5):
 *   - Müşteri 3 gün içinde tasarım dosyasını yüklemezse sipariş iptal
 *   - Ödenen tutar iade edilir (PayTR refund)
 *   - Müşteriye bilgilendirme maili
 *
 * Bu aksiyon yalnızca status=paid + design_files=0 + paid_at > 3 gün
 * olan siparişler için önerilir. WorkflowAuditor tespit eder.
 *
 * NOT: PayTR refund bu aksiyon içinden ÇAĞRILMAZ — Sefa kararıyla
 * order.status='cancelled' set edilir, iade akışı manuel /admin/finans'tan.
 * Otomatik iade riskli (yanlış iptal olursa para kaybı).
 */

import type { ActionHandler } from "../_shared/proposal";

interface CancelPayload {
  orderIds: string[];
  reason?: string;
}

const cancelNoDesignOrder: ActionHandler = async ({ admin, payload }) => {
  const { orderIds, reason = "no_design_3_days" } =
    payload as unknown as CancelPayload;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return {
      result: "failed",
      error: "Invalid payload: 'orderIds' required",
    };
  }

  // Guard: yalnızca status=paid olanları iptal et (race condition)
  const { data, error } = await admin
    .from("orders")
    .update({
      status: "cancelled",
    } as never)
    .in("id", orderIds)
    .eq("status", "paid" as never)
    .select("id");

  if (error) {
    return {
      result: "failed",
      error: `DB update failed: ${error.message}`,
    };
  }

  const updated = (data ?? []) as Array<{ id: string }>;

  // order_events kayıtları (audit)
  if (updated.length > 0) {
    await admin.from("order_events").insert(
      updated.map((r) => ({
        order_id: r.id,
        event_type: "cancelled_no_design",
        payload: {
          reason,
          auditor: "workflow",
          requires_manual_refund: true,
        },
      })) as never
    );
  }

  return {
    result: updated.length === orderIds.length ? "success" : "partial",
    affectedRows: updated.length,
    affectedIds: { orderIds: updated.map((r) => r.id) },
    externalCall: {
      requested: orderIds.length,
      cancelled: updated.length,
      reason,
      note: "PayTR refund manuel — /admin/finans'tan başlat",
    },
  };
};

export default cancelNoDesignOrder;
