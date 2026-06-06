/**
 * runOrderDesignQC — order paid sonrası design QC otomasyonu.
 *
 * Sefa kuralı (16 May v3 baskı onay akışı):
 *   1. Müşteri ödeme yapar → order paid
 *   2. Bu fonksiyon fire-and-forget çağrılır (PayTR "OK" yanıtını bekletmez)
 *   3. order_items'in tasarım dosyaları için QC agent çalışır
 *   4. Aggregate verdict'e göre order.status güncellenir:
 *      - verdict ne olursa olsun → proof_generating (AI rapor üretir, karar vermez)
 *      - operatör baskı öncesi (operator_print_review) karar verir (FAZ 2)
 *
 * Kritik hata: proof_generating + order_event (paid'de takılma önlenir).
 *
 * Sefa 20 May v68 (P1 #7 döngü guard):
 *   orders.qc_attempt_count >= QC_MAX_ATTEMPTS ise AI atlanır:
 *   status = proof_generating (rapor/operatör akışı). Sonsuz döngü guard.
 */

/** P1 #7: AI deneme limiti — bunu geçen sipariş insan-only kuyruğa düşer. */
const QC_MAX_ATTEMPTS = 3;

import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { runDesignQC, mimeToFormat } from "./design-qc";
import { isAiCircuitOpen, notifyAiCircuitOpenIfNeeded } from "./circuit-breaker";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import {
  checkMultiDesignConsistency,
  type DesignQCResult,
} from "@/lib/proof/multi-design-check";
import { orderDesignUploadSlotsComplete } from "@/lib/order-design-upload-slots";

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

export interface RunOrderQCResult {
  orderId: string;
  ranCount: number;
  verdictCounts: Record<"iyi" | "normal" | "kotu" | "error", number>;
  aggregateVerdict: "ready_to_proof" | "needs_review" | "escalated_max_attempts";
}

type VerdictKey = "iyi" | "normal" | "kotu" | "error";

async function recordQcFailureEscalation(
  admin: SupabaseClient,
  orderId: string,
  summary: string,
  detail: Record<string, unknown>
): Promise<void> {
  await admin
    .from("orders")
    .update({ status: "proof_generating" })
    .eq("id", orderId);
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "qc_pipeline_failure",
      status_after: "proof_generating",
      actor_role: "system",
      summary,
      detail,
    },
  ]);
}

/**
 * Bir sipariş için tüm tasarım dosyalarının QC'sini çalıştırır,
 * audit log düşer, order.status'u günceller.
 *
 * Üst seviye hatalarda sipariş proof_generating'e alınır (paid'de takılmaz).
 */
export async function runOrderDesignQC(
  admin: SupabaseClient,
  orderId: string
): Promise<RunOrderQCResult> {
  try {
    return await runOrderDesignQCInner(admin, orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    Sentry.captureException(err, {
      tags: { scope: "design_qc.order_auto_fatal", order_id: orderId },
    });
    console.error("[runOrderDesignQC] fatal:", orderId, err);
    try {
      await recordQcFailureEscalation(admin, orderId, `QC pipeline hatası: ${message}`, {
        error: message,
      });
    } catch (escalateErr) {
      console.error("[runOrderDesignQC] escalation failed:", escalateErr);
    }
    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "needs_review",
    };
  }
}

async function runOrderDesignQCInner(
  admin: SupabaseClient,
  orderId: string
): Promise<RunOrderQCResult> {
  // 0) P1 #7 — Sonsuz döngü guard: 3 attempt'tan sonra AI atlanır,
  // sipariş proof_generating'e düşer (operatör baskı öncesi yakalar).
  const { data: orderRow } = await admin
    .from("orders")
    .select("qc_attempt_count")
    .eq("id", orderId)
    .maybeSingle();
  const currentAttempts =
    ((orderRow as unknown as { qc_attempt_count?: number } | null)
      ?.qc_attempt_count ?? 0);

  if (currentAttempts >= QC_MAX_ATTEMPTS) {
    await admin
      .from("orders")
      .update({ status: "proof_generating" })
      .eq("id", orderId);
    await admin.from("order_events").insert([
      {
        order_id: orderId,
        event_type: "qc_escalated_max_attempts",
        status_after: "proof_generating",
        actor_role: "system",
        summary: `AI ${currentAttempts} kez çalıştı — proof_generating'e escalate (sonsuz döngü guard).`,
        detail: { attempts: currentAttempts, max_attempts: QC_MAX_ATTEMPTS },
      },
    ]);
    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "escalated_max_attempts",
    };
  }

  // 0.5) P1 #8 — OpenAI circuit breaker. Son 10dk hata oranı eşiği geçtiyse
  // AI'a hiç gitme, proof_generating (operatör baskı öncesi karar verir).
  const circuit = await isAiCircuitOpen(admin);
  if (circuit.open) {
    await notifyAiCircuitOpenIfNeeded(admin, orderId, circuit);
    await admin
      .from("orders")
      .update({ status: "proof_generating" })
      .eq("id", orderId);
    await admin.from("order_events").insert([
      {
        order_id: orderId,
        event_type: "ai_circuit_open_fallback",
        status_after: "proof_generating",
        actor_role: "system",
        summary: `AI circuit OPEN — son ${circuit.windowMin}dk hata oranı %${Math.round(
          circuit.failureRate * 100
        )} (${circuit.errorRuns}/${circuit.totalRuns}). proof_generating fallback.`,
        detail: { ...circuit },
      },
    ]);
    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "needs_review",
    };
  }

  // 1) Order items
  const { data: itemsData, error: itemsErr } = await admin
    .from("order_items")
    .select("id, product, width, height")
    .eq("order_id", orderId);

  if (itemsErr || !itemsData || itemsData.length === 0) {
    const reason = itemsErr?.message ?? "empty";
    await recordQcFailureEscalation(
      admin,
      orderId,
      `QC atlandı — sipariş kalemi bulunamadı (${reason})`,
      { reason }
    );
    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "needs_review",
    };
  }

  const items = itemsData as unknown as OrderItemForQC[];

  const slotsComplete = await orderDesignUploadSlotsComplete(admin, orderId);
  if (!slotsComplete) {
    console.warn(
      `[run-order-qc] Order ${orderId}: design upload slots incomplete — skipping QC`
    );
    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "needs_review",
    };
  }

  // 2) Tasarım dosyaları — order_id veya order_item_id ile
  const { data: filesData, error: filesErr } = await admin
    .from("design_files")
    .select("id, storage_path, mime_type, original_name, order_id, order_item_id")
    .eq("order_id", orderId)
    .neq("status", "superseded");

  if (filesErr) {
    await recordQcFailureEscalation(
      admin,
      orderId,
      `QC atlandı — tasarım dosyası sorgusu başarısız (${filesErr.message})`,
      { reason: filesErr.message }
    );
    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "needs_review",
    };
  }

  let files = (filesData ?? []) as unknown as DesignFileForQC[];

  if (files.length === 0) {
    await new Promise((r) => setTimeout(r, 5000));

    const { data: retryFilesData } = await admin
      .from("design_files")
      .select(
        "id, storage_path, mime_type, original_name, order_id, order_item_id"
      )
      .eq("order_id", orderId)
      .neq("status", "superseded");

    const retryFiles = (retryFilesData ?? []) as unknown as DesignFileForQC[];
    if (retryFiles.length > 0) {
      files = retryFiles;
    }
  }

  if (files.length === 0) {
    console.warn(
      `[run-order-qc] Order ${orderId}: no design files found — skipping QC`
    );

    const { data: order } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    if (order?.status === "awaiting_upload") {
      return {
        orderId,
        ranCount: 0,
        verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
        aggregateVerdict: "needs_review",
      };
    }

    console.error(
      `[run-order-qc] Order ${orderId} status=${order?.status} but 0 design files — possible data issue`
    );

    await admin.from("order_events").insert([
      {
        order_id: orderId,
        event_type: "qc_skipped_no_files",
        status_after: order?.status ?? "unknown",
        actor_role: "system",
        summary:
          "QC çalıştı ama design_files boş — müşteri henüz yüklememiş olabilir",
        detail: {
          trigger: "runOrderDesignQC",
          designFileCount: 0,
          attempts: currentAttempts + 1,
        },
      },
    ]);

    return {
      orderId,
      ranCount: 0,
      verdictCounts: { iyi: 0, normal: 0, kotu: 0, error: 0 },
      aggregateVerdict: "needs_review",
    };
  }

  const verdictCounts: Record<VerdictKey, number> = {
    iyi: 0,
    normal: 0,
    kotu: 0,
    error: 0,
  };
  const qcResults: DesignQCResult[] = [];

  // 3) Her dosya için QC paralel — sonuçları topla (race-safe)
  const settled = await Promise.allSettled(
    files.map(async (file) => {
      const item =
        items.find((i) => i.id === file.order_item_id) ?? items[0];

      try {
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
          tokens_used: result.tokensUsed ?? null,
        });

        const qcEntry: DesignQCResult = {
          fileId: file.id,
          fileName: file.original_name,
          dpi: result.effectiveDpi ?? 0,
          colorProfile: result.colorProfile ?? "RGB",
          verdict: result.verdict,
          score: result.score,
          fileType: result.fileType ?? "raster",
        };

        return { verdict: result.verdict as VerdictKey, qcEntry };
      } catch (err) {
        Sentry.captureException(err, {
          tags: { scope: "design_qc.order_auto", order_id: orderId },
          extra: { file_id: file.id },
        });
        await admin.from("design_quality_checks").insert({
          order_id: orderId,
          design_file_id: file.id,
          file_format: mimeToFormat(file.mime_type),
          print_width_mm: item.width,
          print_height_mm: item.height,
          product_type: item.product,
          verdict: "error",
          error: err instanceof Error ? err.message : "unknown",
        });
        return { verdict: "error" as VerdictKey, qcEntry: null };
      }
    })
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      verdictCounts[outcome.value.verdict] += 1;
      if (outcome.value.qcEntry) {
        qcResults.push(outcome.value.qcEntry);
      }
    } else {
      verdictCounts.error += 1;
    }
  }

  // 4) Aggregate karar — FAZ 2: AI rapor üretir, akışı durdurmaz.
  // verdict ne olursa olsun proof_generating; uyarılar operatör baskı öncesi görülür.
  const needsHumanReview =
    verdictCounts.error > 0 || verdictCounts.kotu > 0;
  const hasAnyVerdict =
    verdictCounts.iyi + verdictCounts.normal + verdictCounts.kotu > 0;

  const aggregateVerdict: "ready_to_proof" | "needs_review" =
    !needsHumanReview && hasAnyVerdict ? "ready_to_proof" : "needs_review";

  const { data: currentOrder } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  const qcAllowedStatuses = [
    "paid",
    "awaiting_upload",
    "qc_pending",
    "qc_flagged",
    "human_review",
    "human_review_failed",
  ];

  if (!currentOrder || !qcAllowedStatuses.includes(currentOrder.status)) {
    console.warn(
      `[run-order-qc] Order ${orderId} status=${currentOrder?.status} — not in QC-allowed range, skipping status update`
    );
    return {
      orderId,
      ranCount: files.length,
      verdictCounts,
      aggregateVerdict,
    };
  }

  // 5) Order status update + P1 #7 attempt counter increment
  const nextAttemptCount = currentAttempts + 1;
  const nextStatus = "proof_generating";

  const { error: statusUpdateErr } = await admin
    .from("orders")
    .update({
      status: nextStatus,
      qc_attempt_count: nextAttemptCount,
    })
    .eq("id", orderId);

  if (statusUpdateErr) {
    console.error(
      "[run-order-qc] status update FAILED:",
      orderId,
      statusUpdateErr.message
    );
    const { error: fallbackErr } = await admin
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);
    if (fallbackErr) {
      console.error("[run-order-qc] fallback status update FAILED:", fallbackErr.message);
      throw new Error(`status_update_failed: ${fallbackErr.message}`);
    }
  }

  // Eğer bu son izin verilen attempt ise (counter şimdi maks'e ulaştı) ve
  // sonuç "needs_review" ise admin görsün — sıradaki re-run direkt escalate olacak.
  if (
    aggregateVerdict === "needs_review" &&
    nextAttemptCount >= QC_MAX_ATTEMPTS
  ) {
    await admin.from("order_events").insert([
      {
        order_id: orderId,
        event_type: "qc_attempt_limit_reached",
        status_after: nextStatus,
        actor_role: "system",
        summary: `AI ${nextAttemptCount}/${QC_MAX_ATTEMPTS} attempt — sonraki çağrı escalate olur.`,
        detail: { attempts: nextAttemptCount, verdict_counts: verdictCounts },
      },
    ]);
  }

  if (qcResults.length > 1) {
    const consistency = checkMultiDesignConsistency(qcResults);
    if (!consistency.consistent) {
      await admin.from("order_events").insert([
        {
          order_id: orderId,
          event_type: "design_consistency_warning",
          status_after: nextStatus,
          actor_role: "system",
          summary: "Tasarımlar arasında kalite tutarsızlığı tespit edildi",
          detail: consistency,
        },
      ]);
    }
  }

  // proof_generating → server-side cutline (Puppeteer headless POC).
  // Doğrudan await — after() lambda kapandığında cutline kaybolmasın.
  if (nextStatus === "proof_generating") {
    const { runOrderCutlineGeneration } = await import("./run-order-cutline");
    try {
      await runOrderCutlineGeneration(admin, orderId);
    } catch (cutErr) {
      console.error("[run-order-qc] cutline generation failed:", orderId, cutErr);
    }

    // Server cutline başarısız olsa bile proof_pending'e geç — /onay iframe fallback
    const { data: afterCut } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    if ((afterCut as { status: string } | null)?.status === "proof_generating") {
      await admin
        .from("orders")
        .update({ status: "proof_pending" })
        .eq("id", orderId)
        .eq("status", "proof_generating");
    }
  }

  return {
    orderId,
    ranCount: files.length,
    verdictCounts,
    aggregateVerdict,
  };
}
