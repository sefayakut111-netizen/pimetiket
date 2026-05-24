/**
 * Aksiyon: process_kvkk_deletion — KVKK silme talebini işle.
 *
 * Payload:
 *   { requestIds: string[], reason?: string }
 *
 * Sefa kuralı: KVKK m.7 silme talepleri 30 gün içinde işlenmek zorunda.
 * ComplianceAuditor 25 gün+ SLA hatırlatması yapar; Sefa onayladığında
 * fn_anonymize_user RPC tetiklenir.
 *
 * Önemli: GERÇEK SİLME değil — anonymization (email hash, ad/soyad
 * placeholder, address null). Audit log + VUK 5 yıl saklama
 * gerekliliği nedeniyle "soft delete" uygulanır.
 */

import type { ActionHandler } from "../_shared/proposal";

interface KvkkPayload {
  requestIds: string[];
  reason?: string;
}

const processKvkkDeletion: ActionHandler = async ({ admin, payload }) => {
  const { requestIds, reason = "auditor_sla_30day" } =
    payload as unknown as KvkkPayload;

  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return {
      result: "failed",
      error: "Invalid payload: 'requestIds' required",
    };
  }

  const results: Array<{ requestId: string; ok: boolean; error?: string }> = [];

  for (const requestId of requestIds) {
    try {
      // RPC çağrısı: fn_anonymize_user_by_kvkk_request
      // (Migration 022+ ile gelmesi gerek; yoksa graceful skip)
      const { data, error } = await admin.rpc("fn_process_kvkk_deletion", {
        p_request_id: requestId,
      });

      if (error) {
        results.push({
          requestId,
          ok: false,
          error: error.message,
        });
      } else {
        results.push({ requestId, ok: true });
      }
      void data;
    } catch (err) {
      results.push({
        requestId,
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
    affectedIds: { requestIds: results.filter((r) => r.ok).map((r) => r.requestId) },
    externalCall: { results, reason },
    error:
      failedCount > 0
        ? `${failedCount} request failed (RPC missing?). fn_process_kvkk_deletion Migration 022+ gerektirir.`
        : undefined,
  };
};

export default processKvkkDeletion;
