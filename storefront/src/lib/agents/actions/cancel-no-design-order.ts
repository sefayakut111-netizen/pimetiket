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
import { transitionOrderStatus } from "@/lib/db/transition-order-status";

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

  const updated: string[] = [];
  const errors: string[] = [];

  for (const orderId of orderIds) {
    const result = await transitionOrderStatus(admin, {
      orderId,
      to: "cancelled",
      from: "paid",
      mode: "forward",
      actorRole: "system",
      eventType: "cancelled_no_design",
      summary: `Tasarım yüklenmedi — sipariş iptal (${reason})`,
      detail: {
        reason,
        auditor: "workflow",
        requires_manual_refund: true,
      },
    });

    if (result.ok && !result.unchanged) {
      updated.push(orderId);
    } else if (!result.ok) {
      errors.push(`${orderId}: ${result.error}`);
    }
  }

  if (errors.length > 0 && updated.length === 0) {
    return {
      result: "failed",
      error: errors.join("; "),
    };
  }

  return {
    result: updated.length === orderIds.length ? "success" : "partial",
    affectedRows: updated.length,
    affectedIds: { orderIds: updated },
    externalCall: {
      requested: orderIds.length,
      cancelled: updated.length,
      reason,
      note: "PayTR refund manuel — /admin/finans'tan başlat",
      errors: errors.length > 0 ? errors : undefined,
    },
  };
};

export default cancelNoDesignOrder;
