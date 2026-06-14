/**
 * QC + cutline pipeline kurtarma — qc_pending'de takılı siparişler.
 *
 * Senaryolar:
 *   - PayTR callback after() QC bitmeden lambda kapandı
 *   - promote idempotent dönüş → QC hiç schedule edilmedi
 *   - QC tamamlandı ama cutline öncesi crash
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { orderDesignUploadSlotsComplete } from "@/lib/order-design-upload-slots";
import { transitionOrderStatus } from "@/lib/db/transition-order-status";
import { scheduleOrderDesignQC } from "./schedule-order-design-qc";

const RESUMABLE_STATUSES = new Set([
  "paid",
  "awaiting_upload",
  "qc_pending",
]);

/** Aynı sipariş için kısa sürede tekrar schedule etme (paralel QC önlemi) */
const RESUME_COOLDOWN_MS = 45_000;
const lastResumeAt = new Map<string, number>();

export async function resumeOrderPipelineIfStuck(
  admin: SupabaseClient,
  orderId: string
): Promise<{ action: "none" | "qc_scheduled" | "cutline_only" | "proof_advanced"; reason?: string }> {
  const { data: orderRow } = await admin
    .from("orders")
    .select("status, updated_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow) {
    return { action: "none", reason: "order_not_found" };
  }

  const status = (orderRow as { status: string }).status;
  if (!RESUMABLE_STATUSES.has(status)) {
    return { action: "none", reason: "status_not_resumable" };
  }

  const slotsComplete = await orderDesignUploadSlotsComplete(admin, orderId);
  if (!slotsComplete) {
    return { action: "none", reason: "slots_incomplete" };
  }

  const { count: fileCount } = await admin
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .neq("status", "superseded");

  if (!fileCount) {
    return { action: "none", reason: "no_design_files" };
  }

  // Cutline var ama sipariş hâlâ erken aşamada → proof_pending'e çek
  const { count: cutlineCount } = await admin
    .from("cutline_designs")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("status", ["draft", "auto_generated", "approved", "operator_override"]);

  if (cutlineCount && cutlineCount > 0) {
    if (status === "qc_pending" || status === "awaiting_upload") {
      await transitionOrderStatus(admin, {
        orderId,
        to: "proof_pending",
        from: ["qc_pending", "awaiting_upload"],
        mode: "forward",
        actorRole: "system",
        eventType: "status_changed",
        summary: "Pipeline resume — cutline mevcut, proof_pending",
        detail: { reason: "cutline_exists" },
      });
      return { action: "proof_advanced", reason: "cutline_exists" };
    }
    if (status === "paid") {
      await transitionOrderStatus(admin, {
        orderId,
        to: "proof_pending",
        from: ["paid"],
        mode: "compensating",
        actorRole: "system",
        eventType: "status_changed",
        summary:
          "Pipeline resume (compensating) — cutline mevcut, paid'den proof_pending",
        detail: { reason: "cutline_exists_paid_recovery" },
      });
      return {
        action: "proof_advanced",
        reason: "cutline_exists_paid_recovery",
      };
    }
    return { action: "none", reason: "cutline_exists_wrong_status" };
  }

  const { count: qcCheckCount } = await admin
    .from("design_quality_checks")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  // QC kayıtları var ama cutline yok — doğrudan cutline aşamasına geç
  if ((qcCheckCount ?? 0) > 0 && status === "qc_pending") {
    await transitionOrderStatus(admin, {
      orderId,
      to: "proof_generating",
      from: "qc_pending",
      mode: "forward",
      actorRole: "system",
      eventType: "status_changed",
      summary: "Pipeline resume — QC kayıtları var, cutline başlatılıyor",
    });

    const { runOrderCutlineGeneration } = await import("./run-order-cutline");
    try {
      await runOrderCutlineGeneration(admin, orderId);
    } catch (err) {
      console.error("[resume-order-pipeline] cutline-only failed:", orderId, err);
    }

    const { data: after } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    if ((after as { status: string } | null)?.status === "proof_generating") {
      await transitionOrderStatus(admin, {
        orderId,
        to: "proof_pending",
        from: "proof_generating",
        mode: "forward",
        actorRole: "system",
        eventType: "status_changed",
        summary: "Pipeline resume cutline fallback — proof_pending",
      });
    }

    return { action: "cutline_only", reason: "qc_checks_exist" };
  }

  const now = Date.now();
  const last = lastResumeAt.get(orderId) ?? 0;
  if (now - last < RESUME_COOLDOWN_MS) {
    return { action: "none", reason: "cooldown" };
  }
  lastResumeAt.set(orderId, now);

  if (status === "paid" || status === "awaiting_upload") {
    await transitionOrderStatus(admin, {
      orderId,
      to: "qc_pending",
      from: ["paid", "awaiting_upload"],
      mode: "forward",
      actorRole: "system",
      eventType: "status_changed",
      summary: "Pipeline resume — qc_pending",
    });
  }

  scheduleOrderDesignQC(admin, orderId);
  return { action: "qc_scheduled" };
}
