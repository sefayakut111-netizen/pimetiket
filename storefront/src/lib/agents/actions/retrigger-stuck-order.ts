/**
 * Aksiyon: retrigger_stuck_order — Stuck sipariş için Design QC yeniden tetikle.
 *
 * Payload:
 *   { orderIds: string[], reason?: string }
 *
 * Kullanım senaryosu: proof_generating veya human_review status'unda
 * 6+ saat takılı kalmış sipariş(ler). Manuel olarak Design QC agent'ı
 * tekrar çalıştırır → order.status yeniden hesaplanır.
 *
 * runOrderDesignQC zaten mevcut (src/lib/agents/run-order-qc.ts).
 * Bu wrapper toplu işlem yapar.
 */

import type { ActionHandler } from "../_shared/proposal";
import { runOrderDesignQC } from "../run-order-qc";

interface RetriggerPayload {
  orderIds: string[];
  reason?: string;
}

const retriggerStuckOrder: ActionHandler = async ({ admin, payload }) => {
  const { orderIds, reason = "stuck_retrigger" } =
    payload as unknown as RetriggerPayload;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return {
      result: "failed",
      error: "Invalid payload: 'orderIds' must be non-empty array",
    };
  }

  const results: Array<{ orderId: string; ok: boolean; error?: string }> = [];

  for (const orderId of orderIds) {
    try {
      const res = await runOrderDesignQC(admin, orderId);
      results.push({
        orderId,
        ok: true,
      });
      void res;
    } catch (err) {
      results.push({
        orderId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - successCount;

  return {
    result:
      failedCount === 0 ? "success" : successCount > 0 ? "partial" : "failed",
    affectedRows: successCount,
    affectedIds: { orderIds: results.filter((r) => r.ok).map((r) => r.orderId) },
    externalCall: { results, reason },
    error: failedCount > 0 ? `${failedCount} order failed` : undefined,
  };
};

export default retriggerStuckOrder;
