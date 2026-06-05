/**
 * AuditorBase — Tüm domain denetçi agent'ların türediği abstract class.
 *
 * Her concrete auditor:
 *   1. extend AuditorBase
 *   2. override `async runChecks(): Promise<AuditorRunResult>`
 *   3. AuditorBase.run() çağrıldığında:
 *      - auditor_runs'a "running" kaydı oluşturulur
 *      - runChecks() çalışır
 *      - findings → DB'ye yazılır
 *      - critical+warning'lerin suggestedAction'ları pending_actions'a düşer
 *      - run "success" veya "failed" olarak güncellenir
 *      - Sentry'a hata kayıtları, mail'e özet
 *
 * Kullanım örneği (concrete subclass):
 *
 *   export class SecurityAuditor extends AuditorBase {
 *     constructor() {
 *       super("security", "v1");
 *     }
 *
 *     async runChecks(): Promise<AuditorRunResult> {
 *       const findings: AuditorFinding[] = [];
 *       // ... checks ...
 *       return { findings, summary: "Tüm kontroller geçti" };
 *     }
 *   }
 *
 *   // Cron handler veya manuel run:
 *   const auditor = new SecurityAuditor();
 *   const runId = await auditor.run({ triggerType: "cron" });
 */

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert, TablesUpdate } from "@/lib/supabase/types";
import {
  sendAuditorReport,
  sendActionApprovalRequest,
} from "./mailer";
import type {
  AuditorFinding,
  AuditorName,
  AuditorRunResult,
  Severity,
  TriggerType,
} from "./types";

export interface RunOptions {
  triggerType: TriggerType;
  /** Cron schedule ismi veya user_id (manuel). */
  triggeredBy?: string;
  /** true ise sendAuditorReport atlanır (özel mail akışı için). */
  suppressReportMail?: boolean;
}

export abstract class AuditorBase {
  protected admin: SupabaseClient;

  constructor(
    public readonly auditorName: AuditorName,
    public readonly auditorVersion: string = "v1"
  ) {
    this.admin = createAdminClient();
  }

  /**
   * Concrete auditor'lar bu method'u override eder.
   * Burada bütün check'leri yap, finding listesi döndür.
   */
  protected abstract runChecks(): Promise<AuditorRunResult>;

  /**
   * Public entry point — cron handler veya manuel test çağırır.
   * runChecks()'i sarar, DB'ye logger, hata yakalar.
   */
  async run(opts: RunOptions): Promise<string> {
    const startedAt = Date.now();

    // 1) auditor_runs'a "running" kaydı
    const { data: runRow, error: insertErr } = await this.admin
      .from("auditor_runs")
      .insert({
        auditor_name: this.auditorName,
        auditor_version: this.auditorVersion,
        trigger_type: opts.triggerType,
        triggered_by: opts.triggeredBy ?? null,
        status: "running",
        findings_count: 0,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
      } satisfies TablesInsert<"auditor_runs">)
      .select("id")
      .single();

    if (insertErr || !runRow) {
      const errMsg = insertErr?.message ?? "run_insert_failed";
      Sentry.captureMessage(`[${this.auditorName}] run_insert_failed`, {
        level: "error",
        extra: { error: errMsg },
      });
      throw new Error(`Auditor run insert failed: ${errMsg}`);
    }

    const runId = (runRow as { id: string }).id;

    // 2) runChecks() — concrete agent çalışır
    let result: AuditorRunResult;
    try {
      result = await this.runChecks();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startedAt;

      await this.admin
        .from("auditor_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          error: errMsg,
        } satisfies TablesUpdate<"auditor_runs">)
        .eq("id", runId);

      Sentry.captureException(err, {
        tags: { scope: "auditor", auditor: this.auditorName },
        extra: { runId },
      });

      throw err;
    }

    // 3) Finding sayımları
    const counts = countBySeverity(result.findings);
    const durationMs = Date.now() - startedAt;

    // 4) Finding'leri toplu insert
    const findingRows: TablesInsert<"auditor_findings">[] =
      result.findings.map((f) => ({
        run_id: runId,
        auditor_name: this.auditorName,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        data: (f.data ?? null) as Json | null,
        suggested_action_type: f.suggestedAction?.type ?? null,
        suggested_action_payload: (f.suggestedAction?.payload ??
          null) as Json | null,
        suggested_action_description: f.suggestedAction?.description ?? null,
      }));

    let insertedFindingIds: Array<{ id: string; suggested: boolean; finding: AuditorFinding }> = [];

    if (findingRows.length > 0) {
      const { data: inserted, error: findErr } = await this.admin
        .from("auditor_findings")
        .insert(findingRows)
        .select("id");

      if (findErr) {
        // Finding insert hatası fatal değil — run yine de complete olsun
        Sentry.captureException(findErr, {
          tags: { scope: "auditor.finding_insert", auditor: this.auditorName },
          extra: { runId, count: findingRows.length },
        });
      } else if (inserted) {
        insertedFindingIds = (inserted as { id: string }[]).map((row, i) => ({
          id: row.id,
          suggested: !!result.findings[i].suggestedAction,
          finding: result.findings[i],
        }));
      }
    }

    // 5) suggestedAction olan finding'leri pending_actions'a düşür
    const pendingRows: TablesInsert<"auditor_pending_actions">[] =
      insertedFindingIds
        .filter((x) => x.suggested && x.finding.suggestedAction)
        .map((x) => {
          const sa = x.finding.suggestedAction!;
          return {
            finding_id: x.id,
            run_id: runId,
            auditor_name: this.auditorName,
            action_type: sa.type,
            action_payload: sa.payload as Json,
            title: sa.title,
            description: sa.description,
            severity: x.finding.severity,
            status: "pending",
          };
        });

    if (pendingRows.length > 0) {
      const { error: pendErr } = await this.admin
        .from("auditor_pending_actions")
        .insert(pendingRows);

      if (pendErr) {
        Sentry.captureException(pendErr, {
          tags: {
            scope: "auditor.pending_insert",
            auditor: this.auditorName,
          },
          extra: { runId, count: pendingRows.length },
        });
      }
    }

    // 6) Run'ı tamamla
    await this.admin
      .from("auditor_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        findings_count: result.findings.length,
        critical_count: counts.critical,
        warning_count: counts.warning,
        info_count: counts.info,
        summary: result.summary,
        summary_md: result.summaryMd ?? null,
        metrics_snapshot: (result.metricsSnapshot ?? null) as Json | null,
      } satisfies TablesUpdate<"auditor_runs">)
      .eq("id", runId);

    // 7) Mail bildirimleri
    //
    // Strateji (Sefa kuralı 16 May v2):
    //   - HER run'da mail YOK — sadece warning/critical varsa
    //   - Manuel run (Sefa "Şimdi çalıştır") → mail HER ZAMAN (Sefa test
    //     için bilinçli tetikledi, dönüş bilgisi alsın)
    //   - Cron + info-only → MAIL ATILMAZ (gürültü engelle, günde 9 mail
    //     yerine sadece sorun olduğunda mail gelir)
    //   - Onay isteme maili: SADECE pending_action oluşmuşsa
    const hasIssue = counts.warning > 0 || counts.critical > 0;
    const isManual = opts.triggerType === "manual";
    const shouldSendReport = hasIssue || isManual;

    if (shouldSendReport && !opts.suppressReportMail) {
      void sendAuditorReport({
        auditorName: this.auditorName,
        runId,
        summary: result.summary,
        summaryMd: result.summaryMd,
        findingsCount: result.findings.length,
        criticalCount: counts.critical,
        warningCount: counts.warning,
      }).catch((err) => {
        Sentry.captureException(err, {
          tags: { scope: "auditor.mail_report", auditor: this.auditorName },
          extra: { runId },
        });
      });
    }

    // Pending action varsa ek onay maili (kritik/uyarı olanlar)
    if (pendingRows.length > 0) {
      const firstCritical = pendingRows.find((p) => p.severity === "critical");
      const firstWarning = pendingRows.find((p) => p.severity === "warning");
      const topPending = firstCritical ?? firstWarning;

      if (topPending) {
        // Pending insert sonrası ID lookup — ilki yeterli, kalanı UI'da görünür
        const { data: createdPending } = await this.admin
          .from("auditor_pending_actions")
          .select("id, title, description, severity")
          .eq("run_id", runId)
          .eq("severity", topPending.severity)
          .order("created_at", { ascending: false })
          .limit(1);

        const row = (createdPending ?? [])[0] as
          | {
              id: string;
              title: string;
              description: string;
              severity: "warning" | "critical";
            }
          | undefined;

        if (row) {
          void sendActionApprovalRequest({
            auditorName: this.auditorName,
            pendingActionId: row.id,
            title: row.title,
            description: row.description,
            severity: row.severity,
          }).catch((err) => {
            Sentry.captureException(err, {
              tags: {
                scope: "auditor.mail_approval",
                auditor: this.auditorName,
              },
              extra: { runId, pendingActionId: row.id },
            });
          });
        }
      }
    }

    return runId;
  }

  // ============================================================
  // Helper'lar — concrete auditor'lar kullanabilir
  // ============================================================

  /** Kısa finding oluşturucu (sadece title + description, opsiyonel veri). */
  protected info(
    category: string,
    title: string,
    description: string,
    data?: Record<string, unknown>
  ): AuditorFinding {
    return { category, severity: "info", title, description, data };
  }

  protected warning(
    category: string,
    title: string,
    description: string,
    data?: Record<string, unknown>,
    suggestedAction?: AuditorFinding["suggestedAction"]
  ): AuditorFinding {
    return {
      category,
      severity: "warning",
      title,
      description,
      data,
      suggestedAction,
    };
  }

  protected critical(
    category: string,
    title: string,
    description: string,
    data?: Record<string, unknown>,
    suggestedAction?: AuditorFinding["suggestedAction"]
  ): AuditorFinding {
    return {
      category,
      severity: "critical",
      title,
      description,
      data,
      suggestedAction,
    };
  }
}

// ============================================================
// Helpers
// ============================================================

function countBySeverity(findings: AuditorFinding[]): Record<Severity, number> {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      return acc;
    },
    { info: 0, warning: 0, critical: 0 } as Record<Severity, number>
  );
}
