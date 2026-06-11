/**
 * WorkflowAuditor — ⚙️ İş Akışı Uzmanı
 *
 * Günlük 05:00 UTC cron. Operasyon darboğazlarını yakalar.
 *
 * 5 kontrol:
 *   A. Status takılıkları (proof_generating > 6h, human_review > 48h)
 *   B. QC kuyruğu uzunluğu (>10 = darboğaz)
 *   C. Dosya yükleme bekleyen siparişler (3+ gün)
 *   D. En eski açık sipariş yaşı
 *   E. SLA ihlali (5 iş günü kargo söz)
 */

import { AuditorBase } from "../_shared/base";
import type {
  AuditorFinding,
  AuditorRunResult,
  SuggestedAction,
} from "../_shared/types";
import type { Enums } from "@/lib/supabase/types";

type OrderStatus = Enums<"order_status">;

const TUNE = {
  proofGeneratingMaxHours: 6,
  humanReviewMaxHours: 48,
  qcQueueThreshold: 10,
  noDesignWarningDays: 3,
  slaBusinessDays: 5,
};

export class WorkflowAuditor extends AuditorBase {
  constructor() {
    super("workflow", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    const stuck = await this.checkStuckStatuses();
    findings.push(...stuck.findings);
    metrics.stuck = stuck.metrics;

    const queue = await this.checkQcQueueLength();
    findings.push(...queue.findings);
    metrics.queue = queue.metrics;

    const noDesign = await this.checkNoDesignOrders();
    findings.push(...noDesign.findings);
    metrics.noDesign = noDesign.metrics;

    const oldest = await this.checkOldestOpenOrder();
    findings.push(...oldest.findings);
    metrics.oldest = oldest.metrics;

    const sla = await this.checkSlaViolations();
    findings.push(...sla.findings);
    metrics.sla = sla.metrics;

    const aiQc = await this.checkAiQcPerformance();
    findings.push(...aiQc.findings);
    metrics.aiQc = aiQc.metrics;

    const designReject = await this.checkDesignRejectionRate();
    findings.push(...designReject.findings);
    metrics.designReject = designReject.metrics;

    const fulfillment = await this.checkFulfillmentSpeed();
    findings.push(...fulfillment.findings);
    metrics.fulfillment = fulfillment.metrics;

    const counts = countFindings(findings);
    const summary = buildSummary(counts);

    return {
      findings,
      summary,
      summaryMd: buildSummaryMd(findings, counts),
      metricsSnapshot: metrics,
    };
  }

  // A) Stuck statuses
  private async checkStuckStatuses() {
    const findings: AuditorFinding[] = [];
    const now = Date.now();

    const proofCutoff = new Date(
      now - TUNE.proofGeneratingMaxHours * 3600_000
    );

    // proof_generating
    const { data: proofData } = await this.admin
      .from("orders")
      .select("id, updated_at, created_at")
      .eq("status", "proof_generating")
      .lt("updated_at", proofCutoff.toISOString())
      .limit(50);

    const proofRows = (proofData ?? []) as Array<{
      id: string;
      updated_at: string;
      created_at: string;
    }>;

    if (proofRows.length > 0) {
      const suggestedAction: SuggestedAction = {
        type: "retrigger_stuck_order",
        payload: {
          orderIds: proofRows.map((r) => r.id),
          reason: `stuck_proof_generating_${TUNE.proofGeneratingMaxHours}h`,
        },
        title: `${proofRows.length} stuck sipariş için QC yeniden çalıştır`,
        description: `Bu siparişler ${TUNE.proofGeneratingMaxHours}+ saattir proof_generating durumunda. Design QC agent yeniden çalıştırılır.`,
      };

      findings.push(
        this.warning(
          "stuck_proof_generating",
          `${proofRows.length} sipariş proof_generating'de takılı`,
          `**${proofRows.length}** sipariş ${TUNE.proofGeneratingMaxHours}+ saattir proof_generating durumunda. Design QC agent dönmüş olabilir, manuel re-trigger gerek.`,
          {
            count: proofRows.length,
            threshold_hours: TUNE.proofGeneratingMaxHours,
            sample_ids: proofRows.slice(0, 5).map((r) => r.id),
          },
          suggestedAction
        )
      );
    }

    // human_review
    const reviewCutoff = new Date(
      now - TUNE.humanReviewMaxHours * 3600_000
    );

    const { data: reviewData, count: reviewCount } = await this.admin
      .from("orders")
      .select("id, updated_at", { count: "exact" })
      .eq("status", "human_review")
      .lt("updated_at", reviewCutoff.toISOString())
      .limit(20);

    const reviewRows = (reviewData ?? []) as Array<{
      id: string;
      updated_at: string;
    }>;

    if (reviewRows.length > 0) {
      findings.push(
        this.critical(
          "stuck_human_review",
          `${reviewCount} sipariş human_review'de 48+ saat`,
          `**${reviewCount}** sipariş manuel inceleme bekliyor. Sefa /admin/ai-qc'tan karar vermeli. SLA risk.`,
          {
            count: reviewCount ?? reviewRows.length,
            threshold_hours: TUNE.humanReviewMaxHours,
            sample_ids: reviewRows.slice(0, 5).map((r) => r.id),
          }
        )
      );
    }

    return {
      findings,
      metrics: {
        proofGeneratingStuck: proofRows.length,
        humanReviewStuck: reviewRows.length,
      },
    };
  }

  // B) QC queue length
  private async checkQcQueueLength() {
    const findings: AuditorFinding[] = [];

    const { count } = await this.admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", [
        "human_review",
        "human_review_failed",
        "proof_generating",
      ] satisfies OrderStatus[]);

    const queueLen = count ?? 0;

    if (queueLen > TUNE.qcQueueThreshold) {
      findings.push(
        this.warning(
          "qc_queue_long",
          `QC kuyruğu ${queueLen} sipariş (eşik ${TUNE.qcQueueThreshold})`,
          `Manuel inceleme bekleyen sipariş sayısı normalin üstünde. Sefa /admin/ai-qc'tan toplu karar vermeli ya da QC kriterleri gevşetilmeli (false positive çok).`,
          { queueLength: queueLen, threshold: TUNE.qcQueueThreshold }
        )
      );
    }

    return { findings, metrics: { queueLength: queueLen } };
  }

  // C) No design orders (3+ gün)
  private async checkNoDesignOrders() {
    const findings: AuditorFinding[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TUNE.noDesignWarningDays);

    // status=paid + design_files yok + paid_at > 3 gün
    // Performans için RPC veya complex query; basit yaklaşım: paid + tüm
    // design_files kontrolü
    const { data: paidData } = await this.admin
      .from("orders")
      .select("id, created_at")
      .eq("status", "paid")
      .lt("created_at", cutoff.toISOString())
      .limit(100);

    const paidRows = (paidData ?? []) as Array<{
      id: string;
      created_at: string;
    }>;

    if (paidRows.length === 0) {
      return { findings, metrics: { count: 0 } };
    }

    const ids = paidRows.map((r) => r.id);
    const { data: filesData } = await this.admin
      .from("design_files")
      .select("order_id")
      .in("order_id", ids);

    const ordersWithFiles = new Set(
      ((filesData ?? []) as Array<{ order_id: string }>).map(
        (f) => f.order_id
      )
    );

    const noDesignIds = paidRows
      .filter((r) => !ordersWithFiles.has(r.id))
      .map((r) => r.id);

    if (noDesignIds.length === 0) {
      return { findings, metrics: { count: 0 } };
    }

    const suggestedAction: SuggestedAction = {
      type: "cancel_no_design_order",
      payload: {
        orderIds: noDesignIds,
        reason: `no_design_after_${TUNE.noDesignWarningDays}_days`,
      },
      title: `${noDesignIds.length} siparişi iptal et (dosya yok)`,
      description: `Mesafeli Satış m.5/b: 3 gün içinde tasarım yüklenmediğinde sipariş iptal edilir, iade başlatılır.\n\nNOT: Iade PayTR'den manuel /admin/finans'tan yapılır.`,
    };

    findings.push(
      this.critical(
        "no_design_3_days",
        `${noDesignIds.length} sipariş 3+ gündür dosya bekliyor`,
        `**${noDesignIds.length}** sipariş paid ama tasarım dosyası yüklenmemiş. ${TUNE.noDesignWarningDays} gün eşiği aşıldı; sipariş iptal + iade gerekir.`,
        { count: noDesignIds.length, sample_ids: noDesignIds.slice(0, 5) },
        suggestedAction
      )
    );

    return { findings, metrics: { count: noDesignIds.length } };
  }

  // D) Oldest open order
  private async checkOldestOpenOrder() {
    const findings: AuditorFinding[] = [];

    const { data } = await this.admin
      .from("orders")
      .select("id, created_at, status")
      .not("status", "in", '("delivered","cancelled")')
      .order("created_at", { ascending: true })
      .limit(1);

    const row = ((data ?? []) as Array<{
      id: string;
      created_at: string;
      status: string;
    }>)[0];

    if (!row) return { findings, metrics: { ageDays: 0 } };

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const ageDays = Math.floor(ageMs / 86400_000);

    if (ageDays >= 10) {
      findings.push(
        this.warning(
          "oldest_open_order",
          `En eski açık sipariş ${ageDays} gün (${row.status})`,
          `**${row.id}** kayıtlı sipariş ${ageDays} gündür açık (status: ${row.status}). 5 iş günü teslim sözünü aşmış olabilir.`,
          { orderId: row.id, ageDays, status: row.status }
        )
      );
    }

    return { findings, metrics: { ageDays, oldestId: row.id } };
  }

  // E) SLA violations (5 business days for shipping)
  private async checkSlaViolations() {
    const findings: AuditorFinding[] = [];

    // 7 takvim günü eşiği (~5 iş günü + hafta sonu)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { count } = await this.admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["paid", "qc_pending", "in_production", "ready_to_ship"] satisfies OrderStatus[])
      .lt("created_at", cutoff.toISOString());

    if (count && count > 0) {
      findings.push(
        this.warning(
          "sla_violation",
          `${count} sipariş 5 iş günü SLA'yı aşmış`,
          `Pim Etiket sözü: "5 iş günü içinde kargoya". **${count}** sipariş 7+ takvim gün geçmiş ama henüz kargoya çıkmamış. Müşteriye proaktif bilgi gönderilmeli.`,
          { count, slaBusinessDays: TUNE.slaBusinessDays }
        )
      );
    }

    return { findings, metrics: { violationCount: count ?? 0 } };
  }

  // F) AI QC Performance — ortalama süre + trend
  private async checkAiQcPerformance() {
    const findings: AuditorFinding[] = [];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    // Son 24 saat ortalama süre
    const { data: recentData } = await this.admin
      .from("design_quality_checks")
      .select("duration_ms")
      .gte("created_at", yesterday.toISOString())
      .not("duration_ms", "is", null);

    const recentRows = (recentData ?? []) as Array<{ duration_ms: number }>;

    // Önceki 7 gün ortalama (referans)
    const { data: weeklyData } = await this.admin
      .from("design_quality_checks")
      .select("duration_ms")
      .gte("created_at", lastWeek.toISOString())
      .lt("created_at", yesterday.toISOString())
      .not("duration_ms", "is", null);

    const weeklyRows = (weeklyData ?? []) as Array<{ duration_ms: number }>;

    if (recentRows.length === 0) {
      return {
        findings,
        metrics: { recentAvg: 0, weeklyAvg: 0, deviation: 0 },
      };
    }

    const recentAvg =
      recentRows.reduce((s, r) => s + (r.duration_ms ?? 0), 0) /
      recentRows.length;
    const weeklyAvg =
      weeklyRows.length > 0
        ? weeklyRows.reduce((s, r) => s + (r.duration_ms ?? 0), 0) /
          weeklyRows.length
        : recentAvg;

    const deviation = weeklyAvg > 0 ? (recentAvg - weeklyAvg) / weeklyAvg : 0;

    // 1.5× yavaşlama uyarı, 2× kritik
    if (deviation > 1.0) {
      findings.push(
        this.critical(
          "ai_qc_slow",
          `AI QC ${(deviation * 100).toFixed(0)}% yavaşladı`,
          `Son 24 saat ort: **${(recentAvg / 1000).toFixed(1)}s**. Önceki haftalık ort: ${(weeklyAvg / 1000).toFixed(1)}s. Bu kadar yavaşlama OpenAI rate-limit veya prompt boyutu sorunu olabilir.`,
          { recentAvg, weeklyAvg, deviation, recentCount: recentRows.length }
        )
      );
    } else if (deviation > 0.5) {
      findings.push(
        this.warning(
          "ai_qc_slow",
          `AI QC %${(deviation * 100).toFixed(0)} yavaşladı`,
          `Son 24 saat: ${(recentAvg / 1000).toFixed(1)}s, geçen hafta: ${(weeklyAvg / 1000).toFixed(1)}s. Trend incelemeli.`,
          { recentAvg, weeklyAvg, deviation }
        )
      );
    } else {
      findings.push(
        this.info(
          "ai_qc_performance",
          `AI QC ort. süre: ${(recentAvg / 1000).toFixed(1)}s`,
          `Son 24 saatte ${recentRows.length} run, ortalama ${(recentAvg / 1000).toFixed(1)}s. Haftalık ortalama: ${(weeklyAvg / 1000).toFixed(1)}s.`,
          { recentAvg, weeklyAvg, recentCount: recentRows.length }
        )
      );
    }

    return {
      findings,
      metrics: { recentAvg, weeklyAvg, deviation, recentCount: recentRows.length },
    };
  }

  // G) Design rejection rate — son 7 gün reddedilen tasarım oranı
  private async checkDesignRejectionRate() {
    const findings: AuditorFinding[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data } = await this.admin
      .from("design_quality_checks")
      .select("verdict")
      .gte("created_at", since.toISOString())
      .not("verdict", "is", null);

    const rows = (data ?? []) as Array<{ verdict: string }>;
    if (rows.length === 0) {
      return { findings, metrics: { total: 0, rejected: 0, rate: 0 } };
    }

    const rejected = rows.filter(
      (r) => r.verdict === "fail" || r.verdict === "reject"
    ).length;
    const rate = rejected / rows.length;

    if (rate > 0.25) {
      findings.push(
        this.warning(
          "high_rejection_rate",
          `Tasarım reddetme oranı %${(rate * 100).toFixed(0)} (eşik %25)`,
          `Son 7 günde **${rejected} / ${rows.length}** tasarım reddedildi. Yüksek oran müşteriyi frustre eder — kabul kriterleri çok katı olabilir. Çıktıları /admin/yorumlar + Pim chat'te incele.`,
          { total: rows.length, rejected, rate }
        )
      );
    } else {
      findings.push(
        this.info(
          "rejection_rate",
          `Tasarım reddetme oranı %${(rate * 100).toFixed(0)} (sağlıklı)`,
          `Son 7 gün: ${rejected} red / ${rows.length} toplam. Eşik %25'in altında.`,
          { total: rows.length, rejected, rate }
        )
      );
    }

    return { findings, metrics: { total: rows.length, rejected, rate } };
  }

  // H) Fulfillment speed — paid → shipped ortalama süre (bu hafta vs geçen hafta)
  private async checkFulfillmentSpeed() {
    const findings: AuditorFinding[] = [];

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 14);

    // Bu hafta shipped olan siparişler
    const { data: thisData } = await this.admin
      .from("orders")
      .select("created_at, updated_at")
      .in("status", ["shipped", "delivered"] satisfies OrderStatus[])
      .gte("updated_at", thisWeek.toISOString())
      .limit(200);

    // Geçen hafta shipped olan siparişler
    const { data: lastData } = await this.admin
      .from("orders")
      .select("created_at, updated_at")
      .in("status", ["shipped", "delivered"] satisfies OrderStatus[])
      .gte("updated_at", lastWeek.toISOString())
      .lt("updated_at", thisWeek.toISOString())
      .limit(200);

    const calcAvgDays = (rows: Array<{ created_at: string; updated_at: string }>) => {
      if (rows.length === 0) return 0;
      const totalMs = rows.reduce((s, r) => {
        const diff =
          new Date(r.updated_at).getTime() - new Date(r.created_at).getTime();
        return s + diff;
      }, 0);
      return totalMs / rows.length / 86400_000;
    };

    const thisRows = (thisData ?? []) as Array<{
      created_at: string;
      updated_at: string;
    }>;
    const lastRows = (lastData ?? []) as Array<{
      created_at: string;
      updated_at: string;
    }>;

    const thisAvg = calcAvgDays(thisRows);
    const lastAvg = calcAvgDays(lastRows);

    if (thisRows.length === 0) {
      return { findings, metrics: { thisAvg: 0, lastAvg: 0, deviation: 0 } };
    }

    const deviation = lastAvg > 0 ? (thisAvg - lastAvg) / lastAvg : 0;

    // SLA: 5 iş günü kargoya — yani ortalama 5-7 gün makul
    if (thisAvg > 8) {
      findings.push(
        this.warning(
          "fulfillment_slow",
          `Üretim+kargo süresi yavaşladı: ${thisAvg.toFixed(1)} gün`,
          `Bu hafta paid → shipped ortalama **${thisAvg.toFixed(1)} gün** (SLA 5 iş günü). Geçen hafta: ${lastAvg.toFixed(1)} gün. Fason atölye yoğunluğu veya QC darboğazı olabilir.`,
          { thisAvg, lastAvg, thisCount: thisRows.length }
        )
      );
    } else if (deviation > 0.3 && lastAvg > 0) {
      findings.push(
        this.info(
          "fulfillment_trend",
          `Üretim hızı %${(deviation * 100).toFixed(0)} yavaşladı`,
          `Bu hafta ort: ${thisAvg.toFixed(1)} gün, önceki: ${lastAvg.toFixed(1)} gün. SLA içinde ama trend dikkat.`,
          { thisAvg, lastAvg, deviation }
        )
      );
    } else {
      findings.push(
        this.info(
          "fulfillment_ok",
          `Üretim+kargo: ${thisAvg.toFixed(1)} gün ort (SLA 5 iş)`,
          `Bu hafta ${thisRows.length} sipariş, ort ${thisAvg.toFixed(1)} gün. Geçen hafta: ${lastAvg.toFixed(1)} gün.`,
          { thisAvg, lastAvg, thisCount: thisRows.length }
        )
      );
    }

    return {
      findings,
      metrics: { thisAvg, lastAvg, deviation, thisCount: thisRows.length },
    };
  }
}

// Helpers
function countFindings(findings: AuditorFinding[]) {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      acc.total += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, total: 0 }
  );
}

function buildSummary(counts: ReturnType<typeof countFindings>) {
  if (counts.total === 0)
    return "İş akışı temiz — operasyon darboğazı yok.";
  return `${counts.critical} kritik · ${counts.warning} uyarı tespit edildi.`;
}

function buildSummaryMd(
  findings: AuditorFinding[],
  counts: ReturnType<typeof countFindings>
): string {
  const lines: string[] = [
    `# ⚙️ İş Akışı Raporu`,
    "",
    `**Özet:** ${counts.total} bulgu (${counts.critical} kritik · ${counts.warning} uyarı)`,
    "",
  ];

  if (findings.length === 0) {
    lines.push(
      "✅ Stuck status yok, QC kuyruğu temiz, dosya bekleyen sipariş yok, SLA ihlali yok."
    );
    return lines.join("\n");
  }

  ["critical", "warning", "info"].forEach((sev) => {
    const items = findings.filter((f) => f.severity === sev);
    if (items.length === 0) return;
    const icon = sev === "critical" ? "🔴" : sev === "warning" ? "🟡" : "ℹ️";
    lines.push(`## ${icon} ${sev.toUpperCase()}`);
    items.forEach((f) => lines.push(`- **${f.title}** — ${f.description}`));
    lines.push("");
  });

  return lines.join("\n");
}
