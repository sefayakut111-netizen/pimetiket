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
import type { Json } from "@/lib/supabase/types";

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
  /**
   * Idempotency key — aynı tetikten 2. enqueue çağrısı duplicate yaratmaz.
   * Örnek: `abandoned_cart:${cartId}:${YYYY-MM-DD}`,
   *        `admin_new_order:${orderId}:${adminEmail}`.
   * NOT: Migration 076 ile UNIQUE constraint var.
   */
  idempotencyKey?: string;
}

export interface EnqueueResult {
  ok: boolean;
  /** Yeni veya mevcut outbox kaydının id'si */
  id?: string;
  /** Suppression listesi nedeniyle gönderim engellendi mi? */
  suppressed?: boolean;
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
      p_payload: params.payload as Json,
      p_category: params.category ?? "customer",
      p_target_type: params.targetType ?? undefined,
      p_target_id: params.targetId ?? undefined,
      p_subject: params.subject ?? undefined,
      p_idempotency_key: params.idempotencyKey ?? undefined,
    });

    if (error) {
      console.error("[mail/enqueue] rpc error:", error);
      return { ok: false, error: error.message };
    }
    // RPC null döndürürse → suppression nedeniyle engellenmiş
    if (data === null || data === undefined || String(data) === "") {
      return { ok: true, suppressed: true };
    }

    // Sefa 22 May v68 — B sorun fix:
    // Vercel Hobby plan günlük cron'a izin veriyor (02:05'te bir kez).
    // Mail anında çıksın diye enqueue sonrası process endpoint'ini
    // fire-and-forget tetikle. Cron daily kalır (yedek mekanizma).
    void triggerMailProcess();

    return { ok: true, id: String(data) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    console.error("[mail/enqueue] exception:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Process-mail-outbox cron endpoint'ini eş zamanlı tetikler.
 * Fire-and-forget — caller bekletilmez, hata loglanır ama atılmaz.
 *
 * NOT: CRON_SECRET zorunlu (assertCronAuth). Env yoksa istek 401 alır,
 * sessizce log'lanır — bir sonraki cron run mail'i alır.
 */
async function triggerMailProcess(): Promise<void> {
  try {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      // Env yoksa cron'u tetiklemiyoruz, ama enqueue başarılı —
      // mail kuyrukta, gece cron'u alır.
      return;
    }
    // Fire-and-forget, response bekletmiyoruz
    await fetch(`${siteUrl}/api/cron/process-mail-outbox`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      // Vercel function timeout'unu uzatma
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // Network error vs — sessiz fail. Cron yedek olarak çalışır.
    console.warn(
      "[mail/enqueue] process trigger failed (will run on cron):",
      err instanceof Error ? err.message : err
    );
  }
}
