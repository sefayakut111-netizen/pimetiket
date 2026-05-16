/**
 * runOrderDesignQC — order paid sonrası design QC otomasyonu.
 *
 * Sefa kuralı (16 May v3 baskı onay akışı):
 *   1. Müşteri ödeme yapar → order paid
 *   2. Bu fonksiyon fire-and-forget çağrılır (PayTR "OK" yanıtını bekletmez)
 *   3. order_items'in tasarım dosyaları için QC agent çalışır
 *   4. Aggregate verdict'e göre order.status güncellenir:
 *      - all "iyi" → proof_generating (sonraki adım prova üretimi)
 *      - any "kotu" → human_review (admin /admin/ai-qc'da inceler)
 *      - mixed/normal → human_review (insan göz ister)
 *
 * Hata olursa: order.status değişmez (paid kalır), Sentry log düşer.
 * Admin /admin/ai-qc kuyruğunda manuel re-run yapabilir.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { runDesignQC, mimeToFormat } from "./design-qc";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

interface OrderItemForQC {
  id: string;
  product: "etiket" | "sticker";
  width: number;
  height: number;
}

interface DesignFileForQC {
  id: string;
  storage_path: string;
  mime_type: string;
  original_name: string;
  order_id: string;
  order_item_id: string | null;
}

interface RunOrderQCResult {
  orderId: string;
  ranCount: number;
  verdictCounts: Record<"iyi" | "normal" | "kotu" | "error", number>;
  aggregateVerdict: "ready_to_proof" | "needs_review";
}

/**
 * Bir sipariş için tüm tasarım dosyalarının QC'sini çalıştırır,
 * audit log düşer, order.status'u günceller.
 *
 * @param admin — service-role Supabase client
 * @param orderId — sipariş ID
 * @returns aggregate sonuç
 */
export async function runOrderDesignQC(
  admin: SupabaseClient,
  orderId: string
): Promise<RunOrderQCResult> {
  // 1) Order items
  const { data: itemsData, error: itemsErr } = await admin
    .from("order_items")
    .select("id, product, width, height")
    .eq("order_id", orderId);

  if (itemsErr || !itemsData || itemsData.length === 0) {
    throw new Error(
      `runOrderDesignQC: no items for order ${orderId} (${itemsErr?.message ?? "empty"})`
    );
  }

  const items = itemsData as unknown as OrderItemForQC[];

  // 2) Tasarım dosyaları — order_id veya order_item_id ile
  const { data: filesData, error: filesErr } = await admin
    .from("design_files")
    .select("id, storage_path, mime_type, original_name, order_id, order_item_id")
    .eq("order_id", orderId);

  if (filesErr) {
    throw new Error(`runOrderDesignQC: files query failed — ${filesErr.message}`);
  }

  const files = (filesData ?? []) as unknown as DesignFileForQC[];

  if (files.length === 0) {
    // Sefa kuralı: müşteri 3 gün içinde dosya yükleme süresi var.
    // Şu an dosya yok → QC çalıştırmıyoruz, order paid'de kalıyor.
    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "needs_review",
    };
  }

  const verdictCounts = { iyi: 0, normal: 0, kotu: 0, error: 0 };

  // 3) Her dosya için QC çalıştır (sıralı — paralel race condition riski yok)
  for (const file of files) {
    // İlgili item'i bul (yoksa ilk item'in boyutunu varsay)
    const item =
      items.find((i) => i.id === file.order_item_id) ?? items[0];

    try {
      // Signed URL (1 saat)
      const { data: signed } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(file.storage_path, 3600);
      if (!signed?.signedUrl) {
        throw new Error("signed_url_failed");
      }

      const fileFormat = mimeToFormat(file.mime_type);
      const result = await runDesignQC({
        fileUrl: signed.signedUrl,
        fileFormat,
        printWidthMm: item.width,
        printHeightMm: item.height,
        productType: item.product,
      });

      verdictCounts[result.verdict] += 1;

      // Audit log
      await admin.from("design_quality_checks").insert({
        order_id: orderId,
        design_file_id: file.id,
        file_format: fileFormat,
        print_width_mm: item.width,
        print_height_mm: item.height,
        product_type: item.product,
        verdict: result.verdict,
        score: result.score,
        analysis: {
          fileType: result.fileType,
          effectiveDpi: result.effectiveDpi,
          embeddedRasterCount: result.embeddedRasterCount,
          colorProfile: result.colorProfile,
          hasBleed: result.hasBleed,
          hasCutPath: result.hasCutPath,
          isTextOutlined: result.isTextOutlined,
          visualQuality: result.visualQuality,
        },
        findings: result.findings,
        model: result.model,
        duration_ms: result.durationMs,
        cost_usd: result.costUsd,
      } as never);
    } catch (err) {
      verdictCounts.error += 1;
      Sentry.captureException(err, {
        tags: { scope: "design_qc.order_auto", order_id: orderId },
        extra: { file_id: file.id },
      });
      // Error verdict'i de audit'e yaz
      await admin.from("design_quality_checks").insert({
        order_id: orderId,
        design_file_id: file.id,
        file_format: mimeToFormat(file.mime_type),
        print_width_mm: item.width,
        print_height_mm: item.height,
        product_type: item.product,
        verdict: "error",
        error: err instanceof Error ? err.message : "unknown",
      } as never);
    }
  }

  // 4) Aggregate karar — Sefa kuralı: tek bir hata insan göz gerektirir
  const allGood =
    verdictCounts.kotu === 0 &&
    verdictCounts.normal === 0 &&
    verdictCounts.error === 0 &&
    verdictCounts.iyi > 0;

  const aggregateVerdict: "ready_to_proof" | "needs_review" = allGood
    ? "ready_to_proof"
    : "needs_review";

  // 5) Order status update
  const nextStatus =
    aggregateVerdict === "ready_to_proof" ? "proof_generating" : "human_review";

  await admin
    .from("orders")
    .update({ status: nextStatus } as never)
    .eq("id", orderId);

  return {
    orderId,
    ranCount: files.length,
    verdictCounts,
    aggregateVerdict,
  };
}
