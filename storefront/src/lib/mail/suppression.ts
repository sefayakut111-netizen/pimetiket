/**
 * Mail suppression helpers — server-only.
 *
 * Sefa 21 May v68 — Resend tamamlama paketi.
 *
 * Suppression listesi:
 *   - bounce_hard / complaint → her zaman blokla
 *   - unsubscribe_marketing → lead+marketing'i blokla, transactional'a izin ver
 *   - manual_admin → admin manuel bloklamış
 *
 * KVKK Notu (m.5/2-c):
 *   Müşterinin sipariş onayı, kargo durumu, fatura gibi
 *   transactional maillerini "hizmetin parçası" olduğu için
 *   unsubscribe ile bloklayamayız. Bu yüzden kategori-spesifik
 *   suppression mantığı var.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SuppressionType =
  | "bounce_hard"
  | "bounce_soft_repeated"
  | "complaint"
  | "unsubscribe_marketing"
  | "unsubscribe_blog"
  | "unsubscribe_all"
  | "manual_admin";

export type MailCategory = "fason" | "customer" | "lead" | "admin";

/** Bir mail kategorisi transactional mı (KVKK m.5/2-c kapsamında zorunlu)? */
export function isTransactionalCategory(cat: MailCategory): boolean {
  return cat === "customer" || cat === "admin" || cat === "fason";
}

export interface RecordSuppressionParams {
  email: string;
  type: SuppressionType;
  reason?: string;
  sourceMessageId?: string;
  sourceEventId?: string;
  blockedCategories?: MailCategory[];
}

/** Yeni suppression kaydı (webhook'lar + admin manuel için). */
export async function recordSuppression(
  params: RecordSuppressionParams
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin.rpc("fn_record_suppression", {
      p_email: params.email.toLowerCase().trim(),
      p_type: params.type,
      p_reason: params.reason ?? undefined,
      p_source_message_id: params.sourceMessageId ?? undefined,
      p_source_event_id: params.sourceEventId ?? undefined,
      p_blocked_categories: params.blockedCategories ?? undefined,
    });

    if (error) {
      console.error("[mail/suppression] rpc error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: String(data ?? "") };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    return { ok: false, error: msg };
  }
}

/** Email + kategori bloklu mu? */
export async function isSuppressed(
  email: string,
  category: MailCategory
): Promise<boolean> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin.rpc("fn_is_suppressed", {
      p_email: email.toLowerCase().trim(),
      p_category: category,
    });
    if (error) {
      console.error("[mail/suppression] check error:", error);
      // Fail-open: hata varsa engelleme — mail kuyrukta hata loglar
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.error("[mail/suppression] check threw:", e);
    return false;
  }
}
