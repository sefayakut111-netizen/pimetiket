/**
 * Generic mail enqueue helper — server-only.
 *
 * `fason_mail_outbox` artık polymorphic (Migration 035) — bu helper
 * fason/customer/lead/admin tüm kategorileri tek API'den kuyruğa atar.
 *
 * Resend env yokken (stub mode) bile kayıt INSERT olur; cron daha
 * sonra Resend gelince otomatik gönderir.
 *
 * Kullanım:
 *   await enqueueMail({
 *     templateKey: "lead_welcome",
 *     to: "user@example.com",
 *     payload: { download_url, interests },
 *     category: "lead",
 *     targetType: "subscriber",
 *     targetId: subscriberId,
 *   });
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface EnqueueMailParams {
  /** Şablon anahtarı — `templates.ts` RENDERERS'da kayıtlı */
  templateKey: string;
  /** Alıcı email */
  to: string;
  /** Template'e geçecek veri */
  payload: Record<string, unknown>;
  /** Kategori — admin filter için */
  category?: "fason" | "customer" | "lead" | "admin";
  /** Polymorphic ref tipi */
  targetType?: "assignment" | "order" | "subscriber" | "user" | "cart";
  /** Polymorphic ref id */
  targetId?: string;
  /** Subject override (template'in default'u kullanılacaksa null bırak) */
  subject?: string;
}

export interface EnqueueResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function enqueueMail(
  params: EnqueueMailParams
): Promise<EnqueueResult> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin.rpc("fn_enqueue_mail", {
      p_template_key: params.templateKey,
      p_to_email: params.to.toLowerCase().trim(),
      p_payload: params.payload as never,
      p_category: params.category ?? "customer",
      p_target_type: params.targetType ?? null,
      p_target_id: params.targetId ?? null,
      p_subject: params.subject ?? null,
    } as never);

    if (error) {
      console.error("[mail/enqueue] rpc error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: String(data ?? "") };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    console.error("[mail/enqueue] exception:", msg);
    return { ok: false, error: msg };
  }
}
