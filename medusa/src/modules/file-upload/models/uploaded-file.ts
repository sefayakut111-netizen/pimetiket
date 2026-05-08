/**
 * UploadedFile — müşteri tarafından yüklenmiş tasarım dosyası.
 * 3-gün TTL kuralı: ödeme sonrası 3 gün içinde dosya yüklenmezse uyarı,
 * sonra 7 gün içinde sipariş otomatik iptal.
 */

import { model } from "@medusajs/framework/utils";

export const UploadedFile = model.define("uploaded_file", {
  id: model.id().primaryKey(),
  order_id: model.text().index(),
  // Dosya kullanıcı adı (orijinal) — "Olea_v3.pdf"
  file_name: model.text(),
  // Bytes
  size_bytes: model.number(),
  // MIME type — "application/pdf", "application/postscript" vs
  mime: model.text(),
  // S3/R2 storage URL
  storage_url: model.text(),
  // 3-gün TTL — yüklendikten sonra ne zaman geçersiz olur (preview için)
  // TTL bittikten sonra dosya korunur ama public URL imzası yenilenir
  ttl_expires_at: model.dateTime().nullable(),
  // Müşteri onayladı mı (final tasarım)
  is_final: model.boolean().default(false),
  // SHA256 hash — dedup için
  content_hash: model.text().nullable(),
  uploaded_at: model.dateTime(),
  // Bağlı QCJob ID (varsa)
  qc_job_id: model.text().nullable(),
});
