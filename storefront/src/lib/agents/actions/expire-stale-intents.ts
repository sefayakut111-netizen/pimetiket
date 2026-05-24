/**
 * Aksiyon: expire_stale_intents — Eski pending payment intent'leri kapat.
 *
 * Payload:
 *   { intentIds: string[], reason?: string }
 *
 * Sefa kararı: payment_intent oluşturulup ödeme tamamlanmazsa
 *   - 24 saatlik intent'ler "stale" kabul edilir
 *   - status = 'expired' veya 'failed' set edilir
 *   - PayTR uzun süreli intent'lerde 504 dönebilir, kullanıcı yeni
 *     intent oluşturmak zorunda kalır
 *
 * Bu aksiyon FinanceAuditor tarafından önerilir; Sefa onayladığında
 * toplu update yapılır.
 */

import type { ActionHandler } from "../_shared/proposal";

interface ExpireIntentsPayload {
  intentIds: string[];
  reason?: string;
}

const expireStaleIntents: ActionHandler = async ({ admin, payload }) => {
  const { intentIds, reason = "stale_24h" } =
    payload as unknown as ExpireIntentsPayload;

  if (!Array.isArray(intentIds) || intentIds.length === 0) {
    return {
      result: "failed",
      error: "Invalid payload: 'intentIds' must be non-empty array",
    };
  }

  // Yalnızca status='pending' olanları update et (yarış koşulu önleme)
  const { data, error } = await admin
    .from("payment_intents")
    .update({
      status: "failed",
      failure_reason: `auditor_expired: ${reason}`,
    })
    .in("id", intentIds)
    .eq("status", "pending")
    .select("id");

  if (error) {
    return {
      result: "failed",
      error: `DB update failed: ${error.message}`,
    };
  }

  const updated = (data ?? []) as Array<{ id: string }>;

  return {
    result: updated.length === intentIds.length ? "success" : "partial",
    affectedRows: updated.length,
    affectedIds: { intentIds: updated.map((r) => r.id) },
    externalCall: {
      requested: intentIds.length,
      updated: updated.length,
      reason,
    },
  };
};

export default expireStaleIntents;
