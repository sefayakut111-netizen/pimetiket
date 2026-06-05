/**
 * AppHealthAuditor — 🩺 Uygulama Sağlığı (smoke + sipariş anomali)
 *
 * Günde 2 kez çalışır. E2E değil — kritik endpoint'ler + DB state anomali.
 *
 * A) Endpoint health (müşteri + pricing + admin query)
 * B) Sipariş akışı stuck tespiti
 * C) R2 yedek sentinel (opsiyonel)
 */

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AuditorBase } from "../_shared/base";
import type {
  AuditorFinding,
  AuditorRunResult,
  Severity,
} from "../_shared/types";
import { getSiteUrl } from "@/lib/site-url";
import { isResendConfigured, sendMail } from "@/lib/mail/resend";
import type { ScopeName } from "@/lib/pricing-config-types";

const PRICING_SCOPES: ScopeName[] = [
  "sticker",
  "etiket_rulo",
  "etiket_tabaka",
];

const TUNE = {
  proofPendingHours: 72,
  operatorReviewHours: 48,
  paidStuckHours: 1,
  proofGeneratingMinutes: 30,
  backupMaxAgeDays: 8,
  backupMinBytes: 1024,
};

const ENDPOINT_PATHS = [
  { path: "/", label: "Ana sayfa" },
  { path: "/sticker/yapilandir", label: "Sticker konfigüratör" },
  { path: "/api/health", label: "Health API" },
] as const;

export class AppHealthAuditor extends AuditorBase {
  constructor() {
    super("app_health", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    const endpoints = await this.checkEndpoints();
    findings.push(...endpoints.findings);
    metrics.endpoints = endpoints.metrics;

    const pricing = await this.checkPricingScopes();
    findings.push(...pricing.findings);
    metrics.pricing = pricing.metrics;

    const admin = await this.checkAdminQueries();
    findings.push(...admin.findings);
    metrics.admin = admin.metrics;

    const anomalies = await this.checkOrderAnomalies();
    findings.push(...anomalies.findings);
    metrics.anomalies = anomalies.metrics;

    const backup = await this.checkBackupSentinel();
    findings.push(...backup.findings);
    metrics.backup = backup.metrics;

    const counts = countBySeverity(findings);
    const summary =
      findings.length === 0
        ? "Uygulama sağlığı temiz — endpoint ve sipariş akışı normal"
        : `App health: ${counts.critical} kritik, ${counts.warning} uyarı, ${counts.info} bilgi`;

    return {
      findings,
      summary,
      summaryMd: buildSummaryMd(findings, counts),
      metricsSnapshot: metrics,
    };
  }

  private async checkEndpoints() {
    const findings: AuditorFinding[] = [];
    const base = getSiteUrl();
    const results: Array<{ path: string; status: number | null; ok: boolean }> =
      [];

    for (const { path, label } of ENDPOINT_PATHS) {
      let status: number | null = null;
      let ok = false;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15_000);
        const res = await fetch(`${base}${path}`, {
          method: "GET",
          signal: ctrl.signal,
          headers: { "User-Agent": "PimAppHealthCron/1.0" },
          cache: "no-store",
        });
        clearTimeout(timer);
        status = res.status;
        ok = res.status >= 200 && res.status < 400;
      } catch {
        ok = false;
      }

      results.push({ path, status, ok });
      if (!ok) {
        findings.push(
          this.critical(
            "endpoint_down",
            `${label} yanıt vermiyor`,
            `\`${path}\` HTTP ${status ?? "timeout/error"} döndü. Müşteri akışı etkilenebilir.`,
            { path, status }
          )
        );
      }
    }

    return { findings, metrics: { results } };
  }

  private async checkPricingScopes() {
    const findings: AuditorFinding[] = [];
    const scopeResults: Record<string, boolean> = {};

    for (const scope of PRICING_SCOPES) {
      const { data, error } = await this.admin
        .from("v_pricing_live")
        .select("live_config")
        .eq("scope", scope)
        .maybeSingle();

      const cfg = (data as { live_config?: Record<string, unknown> } | null)
        ?.live_config;
      const filled =
        !error &&
        !!cfg &&
        typeof cfg === "object" &&
        Object.keys(cfg).length > 0;
      scopeResults[scope] = filled;

      if (!filled) {
        findings.push(
          this.critical(
            "pricing_scope_empty",
            `Fiyat config boş: ${scope}`,
            `v_pricing_live scope=\`${scope}\` dolu değil. Konfigüratör fallback'e düşebilir.`,
            { scope, error: error?.message }
          )
        );
      }
    }

    return { findings, metrics: { scopeResults } };
  }

  private async checkAdminQueries() {
    const findings: AuditorFinding[] = [];
    const checks: Record<string, boolean> = {};

    const probes = [
      { key: "orders", table: "orders" as const },
      { key: "fason", table: "order_assignments" as const },
      { key: "customers", table: "profiles" as const },
    ];

    for (const probe of probes) {
      const { error } = await this.admin
        .from(probe.table)
        .select("id", { count: "exact", head: true })
        .limit(1);
      const ok = !error;
      checks[probe.key] = ok;
      if (!ok) {
        findings.push(
          this.critical(
            "admin_query_failed",
            `Admin sorgusu hata: ${probe.key}`,
            `${probe.key} tablosu sorgulanamadı — panel verisi gelmeyebilir.`,
            {
              table: probe.key,
              error: error instanceof Error ? error.message : String(error),
            }
          )
        );
      }
    }

    return { findings, metrics: { checks } };
  }

  private async checkOrderAnomalies() {
    const findings: AuditorFinding[] = [];
    const now = Date.now();
    const metrics: Record<string, number> = {};

    const proofCutoff = new Date(
      now - TUNE.proofPendingHours * 3_600_000
    ).toISOString();
    const { data: proofPendingOrders } = await this.admin
      .from("orders")
      .select("id")
      .eq("status", "proof_pending")
      .lt("updated_at", proofCutoff)
      .limit(50);

    const proofIds = (proofPendingOrders ?? []).map((r) => (r as { id: string }).id);
    metrics.proof_pending_stuck = proofIds.length;
    if (proofIds.length > 0) {
      findings.push(
        this.warning(
          "stuck_proof_pending",
          `${proofIds.length} sipariş prova onayında takılı`,
          `proof_pending durumunda ${TUNE.proofPendingHours}+ saattir bekleyen siparişler var. Müşteri onayı gecikmiş olabilir.`,
          { count: proofIds.length, orderIds: proofIds.slice(0, 20) }
        )
      );
    }

    const reviewCutoff = new Date(
      now - TUNE.operatorReviewHours * 3_600_000
    ).toISOString();
    const { data: operatorReview } = await this.admin
      .from("orders")
      .select("id")
      .eq("status", "operator_print_review")
      .lt("updated_at", reviewCutoff)
      .limit(50);

    const reviewIds = (operatorReview ?? []).map((r) => (r as { id: string }).id);
    metrics.operator_review_stuck = reviewIds.length;
    if (reviewIds.length > 0) {
      findings.push(
        this.warning(
          "stuck_operator_review",
          `${reviewIds.length} sipariş operatör onayında takılı`,
          `operator_print_review ${TUNE.operatorReviewHours}+ saattir bekliyor.`,
          { count: reviewIds.length, orderIds: reviewIds.slice(0, 20) }
        )
      );
    }

    const paidCutoff = new Date(
      now - TUNE.paidStuckHours * 3_600_000
    ).toISOString();
    const { data: paidStuck } = await this.admin
      .from("orders")
      .select("id")
      .eq("status", "paid")
      .lt("updated_at", paidCutoff)
      .limit(50);

    const paidIds = (paidStuck ?? []).map((r) => (r as { id: string }).id);
    metrics.paid_not_promoted = paidIds.length;
    if (paidIds.length > 0) {
      findings.push(
        this.critical(
          "stuck_paid",
          `${paidIds.length} ödenmiş sipariş QC'ye geçmedi`,
          `paid durumunda ${TUNE.paidStuckHours}+ saattir kalan siparişler — ödeme sonrası akış takılmış olabilir.`,
          { count: paidIds.length, orderIds: paidIds.slice(0, 20) }
        )
      );
    }

    const genCutoff = new Date(
      now - TUNE.proofGeneratingMinutes * 60_000
    ).toISOString();
    const { data: proofGen } = await this.admin
      .from("orders")
      .select("id")
      .eq("status", "proof_generating")
      .lt("updated_at", genCutoff)
      .limit(50);

    const genIds = (proofGen ?? []).map((r) => (r as { id: string }).id);
    metrics.proof_generating_stuck = genIds.length;
    if (genIds.length > 0) {
      findings.push(
        this.critical(
          "stuck_proof_generating",
          `${genIds.length} sipariş proof üretiminde takılı`,
          `proof_generating ${TUNE.proofGeneratingMinutes}+ dakikadır sürüyor — AI/QC raporu üretilmemiş olabilir.`,
          { count: genIds.length, orderIds: genIds.slice(0, 20) }
        )
      );
    }

    return { findings, metrics };
  }

  private async checkBackupSentinel() {
    const findings: AuditorFinding[] = [];
    const accountId =
      process.env.R2_BACKUP_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
    const accessKey =
      process.env.R2_BACKUP_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
    const secretKey =
      process.env.R2_BACKUP_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BACKUP_BUCKET ?? "pimetiket-backups";

    if (!accountId || !accessKey || !secretKey) {
      return {
        findings,
        metrics: { configured: false, skipped: true },
      };
    }

    try {
      const client = new S3Client({
        region: "auto",
        endpoint:
          process.env.R2_BACKUP_ENDPOINT ??
          `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        forcePathStyle: true,
      });

      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: "weekly/",
          MaxKeys: 100,
        })
      );
      const manifests = (res.Contents ?? []).filter((o) =>
        o.Key?.endsWith("/manifest.json")
      );
      if (manifests.length === 0) {
        findings.push(
          this.warning(
            "backup_missing",
            "R2 yedek manifest bulunamadı",
            "weekly/ altında manifest.json yok — GitHub backup workflow kontrol edilmeli.",
            { bucket }
          )
        );
        return { findings, metrics: { configured: true, manifestCount: 0 } };
      }

      const latest = manifests.sort((a, b) =>
        (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0)
      )[0];
      const ageMs =
        Date.now() - (latest.LastModified?.getTime() ?? Date.now());
      const ageDays = ageMs / 86_400_000;
      const size = latest.Size ?? 0;

      if (ageDays > TUNE.backupMaxAgeDays) {
        findings.push(
          this.warning(
            "backup_stale",
            `Son yedek ${Math.floor(ageDays)} gün önce`,
            `En son manifest ${TUNE.backupMaxAgeDays} günden eski — backup workflow çalışmıyor olabilir.`,
            { ageDays: Math.round(ageDays), key: latest.Key }
          )
        );
      }

      if (size < TUNE.backupMinBytes) {
        findings.push(
          this.warning(
            "backup_tiny",
            "Son yedek manifest çok küçük",
            `manifest.json boyutu ${size} byte — boş veya eksik yedek olabilir.`,
            { size_bytes: size, key: latest.Key }
          )
        );
      }

      return {
        findings,
        metrics: {
          configured: true,
          manifestCount: manifests.length,
          latestAgeDays: Math.round(ageDays * 10) / 10,
          latestSize: size,
        },
      };
    } catch (err) {
      findings.push(
        this.warning(
          "backup_check_failed",
          "R2 yedek kontrolü başarısız",
          "Yedek bucket listelenemedi — credentials veya bucket adı kontrol edilmeli.",
          { error: err instanceof Error ? err.message : String(err) }
        )
      );
      return { findings, metrics: { configured: true, error: true } };
    }
  }
}

function countBySeverity(findings: AuditorFinding[]) {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      return acc;
    },
    { info: 0, warning: 0, critical: 0 } as Record<Severity, number>
  );
}

function buildSummaryMd(
  findings: AuditorFinding[],
  counts: Record<Severity, number>
) {
  if (findings.length === 0) {
    return "Tüm endpoint ve sipariş akışı kontrolleri geçti.";
  }
  const lines = findings.map(
    (f) => `- **${f.severity}** · ${f.title}: ${f.description}`
  );
  return `**Özet:** ${counts.critical} kritik, ${counts.warning} uyarı\n\n${lines.join("\n")}`;
}

/** Finding fingerprint — aynı anomali tekrar mail atmasın diye. */
export function fingerprintFindings(findings: AuditorFinding[]): string {
  return findings
    .filter((f) => f.severity === "critical" || f.severity === "warning")
    .map((f) => `${f.severity}:${f.category}:${JSON.stringify(f.data ?? {})}`)
    .sort()
    .join("|");
}

/**
 * Kritik/uyarı bulguları için dedup'lu admin maili.
 * Önceki run ile aynı fingerprint ise ve son 24 saat içindeyse atlanır.
 */
export async function sendDedupedAppHealthMail(
  admin: SupabaseClient,
  runId: string,
  findings: AuditorFinding[]
): Promise<boolean> {
  const actionable = findings.filter(
    (f) => f.severity === "critical" || f.severity === "warning"
  );
  if (actionable.length === 0) return false;

  const fp = fingerprintFindings(findings);
  const dayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const { data: prevRuns } = await admin
    .from("auditor_runs")
    .select("id, started_at")
    .eq("auditor_name", "app_health")
    .eq("status", "success")
    .neq("id", runId)
    .order("started_at", { ascending: false })
    .limit(1);

  const prevRun = (prevRuns ?? [])[0] as
    | { id: string; started_at: string }
    | undefined;

  if (prevRun && prevRun.started_at >= dayAgo) {
    const { data: prevFindings } = await admin
      .from("auditor_findings")
      .select("severity, category, data")
      .eq("run_id", prevRun.id);

    const prevFp = fingerprintFindings(
      (prevFindings ?? []).map((row) => ({
        category: (row as { category: string }).category,
        severity: (row as { severity: Severity }).severity,
        title: "",
        description: "",
        data: (row as { data: Record<string, unknown> | null }).data ?? undefined,
      }))
    );

    if (prevFp === fp) return false;
  }

  const recipients = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

  if (recipients.length === 0 || !isResendConfigured()) return false;

  const critical = actionable.filter((f) => f.severity === "critical");
  const lines = actionable
    .map(
      (f) =>
        `<li><strong>[${f.severity}]</strong> ${f.title}${f.data?.count != null ? ` (${f.data.count})` : ""}</li>`
    )
    .join("");

  const site = getSiteUrl();
  const html = `
    <h2>App Health — smoke denetçi uyarısı</h2>
    <p><strong>${critical.length}</strong> kritik, <strong>${actionable.length - critical.length}</strong> uyarı tespit edildi.</p>
    <ul>${lines}</ul>
    <p><a href="${site}/admin/denetciler/app_health">Denetçi paneli</a></p>
  `;

  const result = await sendMail({
    to: recipients,
    subject: `[Pim Etiket] App health: ${critical.length} kritik bulgu`,
    html,
    text: `App health: ${critical.length} kritik, ${actionable.length} toplam uyarı. Panel: ${site}/admin/denetciler/app_health`,
  });

  return result.ok;
}
