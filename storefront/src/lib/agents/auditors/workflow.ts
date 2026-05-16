/**
 * WorkflowAuditor — ⚙️ İş Akışı Uzmanı
 *
 * 4 saatlik çalışır. Operasyon darboğazlarını yakalar.
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
      .eq("status", "proof_generating" as never)
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
      .eq("status", "human_review" as never)
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
      ] as never);

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
      .eq("status", "paid" as never)
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
      .in("order_id", ids as never);

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
      .not("status", "in", '("delivered","cancelled")' as never)
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
      .in("status", ["paid", "qc_pending", "in_production", "ready_to_ship"] as never)
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
