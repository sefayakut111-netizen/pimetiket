/**
 * Restore Service — R2'den sıcak katmana veri çağırma.
 *
 * Sefa 18 May v68 (R2 cold storage paketi):
 * Müşteri panel/Cowork sorgu yaptığında arşivdeki dosyaya signed URL üretir.
 * Yetki kontrolü + KVKK audit log dahildir.
 */

import { createClient } from "@supabase/supabase-js";
import { getSignedDownloadUrl } from "./r2-client";

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[restore-service] NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY env eksik"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  dryRun?: boolean;
}

export interface RestoreErrorResult {
  error: string;
}

/**
 * Müşterinin arşivdeki bir tasarım dosyasına 1 saatlik signed URL üretir.
 * Erişimi cold_access olarak log'lar (KVKK).
 *
 * Yetki kontrolü:
 *   - 'user'   → sadece kendi dosyası
 *   - 'admin'  → tüm dosyalar
 *   - 'cowork' → tüm dosyalar (Cowork müdür sorgu)
 */
export async function getArchivedDesignFileUrl(params: {
  designFileId: string;
  requesterId: string;
  requesterType: "user" | "admin" | "cowork";
  reason?: string;
  ttlSeconds?: number;
}): Promise<SignedUrlResult | RestoreErrorResult> {
  const supabase = makeServiceClient();

  const { data: file, error } = await supabase
    .from("design_files")
    .select("id, user_id, archive_status, archive_path, original_name")
    .eq("id", params.designFileId)
    .single();

  if (error || !file) {
    return { error: "Dosya bulunamadı" };
  }

  // B1 — Yetki kontrolü cold-check'ten ÖNCE: sahibi olmayan 'user' dosyanın varlığını/durumunu
  // öğrenmesin (anti-enumeration). Generic mesaj → route 404'e eşler. admin/cowork ownership atlar.
  if (params.requesterType === "user" && file.user_id !== params.requesterId) {
    return { error: "Dosya bulunamadı" };
  }

  if (file.archive_status !== "cold" || !file.archive_path) {
    return { error: "Dosya arşivde değil (durum: " + file.archive_status + ")" };
  }

  const ttl = params.ttlSeconds ?? 3600; // 1 saat default
  const url = await getSignedDownloadUrl(file.archive_path, ttl);
  const expiresAt = new Date(Date.now() + ttl * 1000);

  // Audit log
  await supabase.from("archive_events").insert({
    event_type: "cold_access",
    resource_type: "design_file",
    resource_id: params.designFileId,
    user_id: file.user_id,
    actor_id: params.requesterId,
    actor_type: params.requesterType,
    archive_path: file.archive_path,
    reason: params.reason ?? "Müşteri panel indirme talebi",
    metadata: { ttl_seconds: ttl, original_name: file.original_name },
  });

  return { url, expiresAt };
}

/**
 * Müşterinin tüm hesabını sıcak katmana geri çeker.
 * Tekrar sipariş verdiğinde veya admin manuel restore yaparsa tetiklenir.
 *
 * NOT: Bu versiyon SADECE status'u 'hot' yapar. Tasarım dosyaları R2'de
 * kalır, signed URL ile erişim devam eder. İleri versiyonda (V2) aktif
 * sipariş için son dosya Supabase Storage'a geri kopyalanır.
 */
export async function restoreCustomerToHot(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = makeServiceClient();

  try {
    // 1. 'restoring' status (geçici)
    await supabase
      .from("profiles")
      .update({ archive_status: "restoring" })
      .eq("id", userId);

    // 2. Audit log
    await supabase.from("archive_events").insert({
      event_type: "restored_to_hot",
      resource_type: "customer_bundle",
      resource_id: userId,
      user_id: userId,
      actor_type: "system",
      reason,
    });

    // 3. 'hot' status final
    await supabase
      .from("profiles")
      .update({
        archive_status: "hot",
        archived_at: null,
      })
      .eq("id", userId);

    // 4. Orders / reviews / returns için de hot'a al
    await supabase
      .from("orders")
      .update({ archive_status: "hot", archived_at: null })
      .eq("user_id", userId);

    await supabase
      .from("reviews")
      .update({ archive_status: "hot", archived_at: null })
      .eq("user_id", userId);

    await supabase
      .from("returns")
      .update({ archive_status: "hot", archived_at: null })
      .eq("user_id", userId);

    await supabase
      .from("design_files")
      .update({ archive_status: "hot", archived_at: null })
      .eq("user_id", userId);

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
