/**
 * DataHygieneAuditor — 🧹 Veri Hijyen Denetçisi
 *
 * Haftalık Pazar 03:00 (düşük trafik). DB temizliği + retention.
 *
 * 4 kontrol:
 *   A. Yetim cart_items (90+ gün updated_at, paid order yok)
 *   B. Eski payment_intents (status='failed' + 30+ gün)
 *   C. Tablo büyüme hızı (info)
 *   D. Failed run cleanup (auditor_runs status='failed' 30+ gün)
 */

import { AuditorBase } from "../_shared/base";
import type {
  AuditorFinding,
  AuditorRunResult,
  SuggestedAction,
} from "../_shared/types";

const TUNE = {
  orphanCartDays: 90,
  oldFailedIntentDays: 30,
  oldFailedRunDays: 30,
  staleUploadHours: 24,
  orphanPreviewDays: 7,
};

export class DataHygieneAuditor extends AuditorBase {
  constructor() {
    super("data_hygiene", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    const orphanCart = await this.checkOrphanCartItems();
    findings.push(...orphanCart.findings);
    metrics.orphanCart = orphanCart.metrics;

    const oldIntents = await this.checkOldFailedIntents();
    findings.push(...oldIntents.findings);
    metrics.oldIntents = oldIntents.metrics;

    const tables = await this.checkTableSizes();
    findings.push(...tables.findings);
    metrics.tables = tables.metrics;

    const oldRuns = await this.checkOldFailedRuns();
    findings.push(...oldRuns.findings);
    metrics.oldRuns = oldRuns.metrics;

    const staleUploads = await this.checkStaleIncompleteUploads();
    findings.push(...staleUploads.findings);
    metrics.staleUploads = staleUploads.metrics;

    const orphanPreviews = await this.checkOrphanDesignPreviews();
    findings.push(...orphanPreviews.findings);
    metrics.orphanPreviews = orphanPreviews.metrics;

    const counts = countFindings(findings);
    return {
      findings,
      summary:
        counts.total === 0
          ? "DB temiz, retention güncel."
          : `${counts.warning} temizlik önerisi.`,
      summaryMd: buildSummaryMd(findings, counts),
      metricsSnapshot: metrics,
    };
  }

  // A) Yetim cart_items
  private async checkOrphanCartItems() {
    const findings: AuditorFinding[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TUNE.orphanCartDays);

    const { data, count } = await this.admin
      .from("cart_items")
      .select("id, user_id, updated_at", { count: "exact" })
      .lt("updated_at", cutoff.toISOString())
      .order("updated_at", { ascending: true })
      .limit(100);

    const rows = (data ?? []) as Array<{
      id: string;
      user_id: string | null;
      updated_at: string;
    }>;

    if (rows.length === 0) {
      return { findings, metrics: { count: 0 } };
    }

    const suggestedAction: SuggestedAction = {
      type: "cleanup_orphan_cart",
      payload: {
        cartItemIds: rows.map((r) => r.id),
        reason: `orphan_${TUNE.orphanCartDays}d`,
      },
      title: `${rows.length} yetim cart_items temizle`,
      description: `90+ gündür güncellenmemiş cart kayıtları silinir. Performans + storage tasarrufu.`,
    };

    findings.push(
      this.warning(
        "orphan_cart_items",
        `${count ?? rows.length} yetim cart_items kayıt`,
        `**${count ?? rows.length}** cart_items kaydı ${TUNE.orphanCartDays}+ gündür güncellenmemiş. Kullanıcı muhtemelen siteyi terk etti.`,
        { count: count ?? rows.length, threshold_days: TUNE.orphanCartDays },
        suggestedAction
      )
    );

    return { findings, metrics: { count: count ?? rows.length } };
  }

  // B) Eski failed payment_intents
  private async checkOldFailedIntents() {
    const findings: AuditorFinding[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TUNE.oldFailedIntentDays);

    const { count } = await this.admin
      .from("payment_intents")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .lt("created_at", cutoff.toISOString());

    if (!count || count === 0) {
      return { findings, metrics: { count: 0 } };
    }

    findings.push(
      this.info(
        "old_failed_intents",
        `${count} eski failed payment_intent`,
        `**${count}** failed payment intent ${TUNE.oldFailedIntentDays}+ gün önce oluşmuş. Manuel cleanup veya soft archive düşünülebilir (henüz aksiyon yok — audit trail için tutuluyor).`,
        { count, threshold_days: TUNE.oldFailedIntentDays }
      )
    );

    return { findings, metrics: { count } };
  }

  // C) Tablo boyutları (basit count)
  private async checkTableSizes() {
    const findings: AuditorFinding[] = [];
    const tables = [
      "orders",
      "order_items",
      "design_files",
      "payment_intents",
      "cart_items",
      "audit_log",
      "auditor_runs",
      "auditor_findings",
    ];

    const sizes: Record<string, number> = {};
    for (const t of tables) {
      const { count } = await this.admin
        .from(t)
        .select("*", { count: "exact", head: true });
      sizes[t] = count ?? 0;
    }

    findings.push(
      this.info(
        "table_sizes",
        `DB tablo büyüklükleri`,
        Object.entries(sizes)
          .map(([t, c]) => `- **${t}**: ${c.toLocaleString("tr-TR")}`)
          .join("\n"),
        { sizes }
      )
    );

    return { findings, metrics: { sizes } };
  }

  // D) Eski failed auditor_runs
  private async checkOldFailedRuns() {
    const findings: AuditorFinding[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TUNE.oldFailedRunDays);

    const { count } = await this.admin
      .from("auditor_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .lt("started_at", cutoff.toISOString());

    if (!count || count === 0) return { findings, metrics: { count: 0 } };

    findings.push(
      this.info(
        "old_failed_runs",
        `${count} eski failed auditor_run`,
        `**${count}** auditor run başarısız + ${TUNE.oldFailedRunDays}+ gün eski. Tetikleyici cron tepkisi/migration sorunu var mı kontrol et.`,
        { count, threshold_days: TUNE.oldFailedRunDays }
      )
    );

    return { findings, metrics: { count } };
  }

  // E) Yarım upload-init (complete edilmemiş design_files)
  private async checkStaleIncompleteUploads() {
    const findings: AuditorFinding[] = [];
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - TUNE.staleUploadHours);

    const { count } = await this.admin
      .from("design_files")
      .select("*", { count: "exact", head: true })
      .eq("status", "uploaded")
      .is("sha256", null)
      .lt("created_at", cutoff.toISOString());

    if (!count || count === 0) {
      return { findings, metrics: { count: 0 } };
    }

    findings.push(
      this.warning(
        "stale_incomplete_uploads",
        `${count} yarım design upload`,
        `**${count}** design_files satırı \`uploaded\` durumunda ve ${TUNE.staleUploadHours}h+ complete edilmemiş. \`/api/cron/cleanup-stale-uploads\` ile temizlenebilir.`,
        { count, threshold_hours: TUNE.staleUploadHours },
        {
          type: "cleanup_stale_uploads",
          payload: { reason: "auditor_recommendation" },
          title: "Yarım upload'ları temizle",
          description: "upload-init without upload-complete orphan kayıtları.",
        }
      )
    );

    return { findings, metrics: { count } };
  }

  // F) design-previews orphan sayımı (cart referansı yok)
  private async checkOrphanDesignPreviews() {
    const findings: AuditorFinding[] = [];

    const { count: cartPreviewCount } = await this.admin
      .from("cart_items")
      .select("*", { count: "exact", head: true })
      .not("design_preview_url", "is", null);

    findings.push(
      this.info(
        "design_preview_refs",
        `Cart preview referansları: ${cartPreviewCount ?? 0}`,
        `Aktif cart_items.design_preview_url sayısı: **${cartPreviewCount ?? 0}**. Orphan temizlik: \`/api/cron/cleanup-orphan-previews\` (${TUNE.orphanPreviewDays}d+).`,
        {
          cart_preview_refs: cartPreviewCount ?? 0,
          orphan_threshold_days: TUNE.orphanPreviewDays,
        }
      )
    );

    return { findings, metrics: { cartPreviewRefs: cartPreviewCount ?? 0 } };
  }
}

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

function buildSummaryMd(
  findings: AuditorFinding[],
  counts: ReturnType<typeof countFindings>
): string {
  const lines: string[] = [
    `# 🧹 Veri Hijyen Raporu`,
    "",
    `**Özet:** ${counts.total} bulgu (${counts.warning} uyarı · ${counts.info} bilgi)`,
    "",
  ];

  if (findings.length === 0) {
    lines.push("✅ DB temiz, yetim kayıt yok, retention güncel.");
    return lines.join("\n");
  }

  findings.forEach((f) => {
    const icon = f.severity === "warning" ? "🟡" : "ℹ️";
    lines.push(`${icon} **${f.title}**`);
    lines.push(f.description);
    lines.push("");
  });

  return lines.join("\n");
}
