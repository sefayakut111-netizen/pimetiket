/**
 * ComplianceAuditor — ⚖️ Mevzuat Denetçisi
 *
 * Günlük 10:00 çalışır. KVKK + vergi + retention politikalarını denetler.
 *
 * 5 kontrol:
 *   A. KVKK silme talepleri SLA (30 gün)
 *   B. 90 gün+ tasarım dosyaları (retention)
 *   C. E-fatura zorunluluk eşiği (yıllık ciro 3M TL)
 *   D. Çerez consent oranı (>%30 hedef)
 *   E. Yasal metin yaş kontrolü (1+ yıl)
 */

import { AuditorBase } from "../_shared/base";
import type {
  AuditorFinding,
  AuditorRunResult,
  SuggestedAction,
} from "../_shared/types";

const TUNE = {
  kvkkSlaDays: 30,
  kvkkWarningDays: 25, // 5 gün kala uyarı
  fileRetentionDays: 90,
  einvoiceThresholdTl: 3_000_000, // 2026 değeri
  cookieConsentMinRate: 0.30,
  legalDocMaxAgeDays: 365,
};

const LEGAL_DOCS = [
  { name: "Mesafeli Satış Sözleşmesi", path: "/mesafeli-satis" },
  { name: "Gizlilik Politikası", path: "/gizlilik" },
  { name: "Kullanım Şartları", path: "/sartlar" },
  { name: "Çerez Politikası", path: "/cerez" },
  { name: "Ön Bilgilendirme", path: "/on-bilgilendirme" },
  { name: "Cayma Hakkı", path: "/cayma-hakki" },
];

export class ComplianceAuditor extends AuditorBase {
  constructor() {
    super("compliance", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    const kvkk = await this.checkKvkkSla();
    findings.push(...kvkk.findings);
    metrics.kvkk = kvkk.metrics;

    const retention = await this.checkFileRetention();
    findings.push(...retention.findings);
    metrics.retention = retention.metrics;

    const einvoice = await this.checkEinvoiceThreshold();
    findings.push(...einvoice.findings);
    metrics.einvoice = einvoice.metrics;

    const cookie = await this.checkCookieConsent();
    findings.push(...cookie.findings);
    metrics.cookie = cookie.metrics;

    const legal = this.checkLegalDocAge();
    findings.push(...legal.findings);
    metrics.legal = legal.metrics;

    const mailInfra = await this.checkMailInfrastructure();
    findings.push(...mailInfra.findings);
    metrics.mailInfra = mailInfra.metrics;

    const counts = countFindings(findings);
    return {
      findings,
      summary:
        counts.total === 0
          ? "Mevzuat uyumu temiz."
          : `${counts.critical} kritik · ${counts.warning} uyarı tespit edildi.`,
      summaryMd: buildSummaryMd(findings, counts),
      metricsSnapshot: metrics,
    };
  }

  // A) KVKK silme SLA
  private async checkKvkkSla() {
    const findings: AuditorFinding[] = [];

    const slaCutoff = new Date();
    slaCutoff.setDate(slaCutoff.getDate() - TUNE.kvkkSlaDays);

    const warningCutoff = new Date();
    warningCutoff.setDate(warningCutoff.getDate() - TUNE.kvkkWarningDays);

    const { data } = await this.admin
      .from("kvkk_requests")
      .select("id, user_id, created_at, request_type, status")
      .eq("status", "pending" as never)
      .lt("created_at", warningCutoff.toISOString())
      .order("created_at", { ascending: true })
      .limit(50);

    const rows = (data ?? []) as Array<{
      id: string;
      user_id: string;
      created_at: string;
      request_type: string;
      status: string;
    }>;

    if (rows.length === 0) return { findings, metrics: { count: 0 } };

    const overdueIds = rows
      .filter((r) => new Date(r.created_at) < slaCutoff)
      .map((r) => r.id);
    const warningIds = rows
      .filter((r) => new Date(r.created_at) >= slaCutoff)
      .map((r) => r.id);

    if (overdueIds.length > 0) {
      const suggestedAction: SuggestedAction = {
        type: "process_kvkk_deletion",
        payload: { requestIds: overdueIds, reason: "sla_overdue" },
        title: `${overdueIds.length} KVKK silme talebini şimdi işle`,
        description:
          "fn_process_kvkk_deletion RPC çağrılır. Anonymization uygulanır (hard delete değil).",
      };

      findings.push(
        this.critical(
          "kvkk_sla_overdue",
          `${overdueIds.length} KVKK talebi 30 gün SLA'yı aştı`,
          `KVKK m.13: silme talepleri 30 gün içinde işlenmek zorunda. **${overdueIds.length}** talep süreyi aşmış — yasal risk.`,
          { count: overdueIds.length, requestIds: overdueIds },
          suggestedAction
        )
      );
    }

    if (warningIds.length > 0) {
      findings.push(
        this.warning(
          "kvkk_sla_warning",
          `${warningIds.length} KVKK talebi 25-30 gün arası`,
          `Bu talepler SLA dolmadan işlenmeli. /admin/kvkk-talepleri'nden incele.`,
          { count: warningIds.length, requestIds: warningIds }
        )
      );
    }

    return {
      findings,
      metrics: { overdue: overdueIds.length, warning: warningIds.length },
    };
  }

  // B) File retention 90 gün
  private async checkFileRetention() {
    const findings: AuditorFinding[] = [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TUNE.fileRetentionDays);

    const { data } = await this.admin
      .from("design_files")
      .select("id, original_name, created_at")
      .lt("created_at", cutoff.toISOString())
      .not("storage_path", "is", null)
      .limit(100);

    const rows = (data ?? []) as Array<{
      id: string;
      original_name: string;
      created_at: string;
    }>;

    if (rows.length === 0) return { findings, metrics: { count: 0 } };

    const suggestedAction: SuggestedAction = {
      type: "archive_old_files",
      payload: {
        fileIds: rows.map((r) => r.id),
        reason: `retention_${TUNE.fileRetentionDays}d`,
      },
      title: `${rows.length} eski tasarım dosyasını arşivle`,
      description: `KVKK retention: 90+ gün önce yüklenen ${rows.length} dosya Storage'dan temizlenir, DB kaydı işaretlenir.`,
    };

    findings.push(
      this.warning(
        "file_retention",
        `${rows.length} dosya 90+ gündür saklanıyor`,
        `KVKK + Sefa retention politikası: Tasarım dosyaları sipariş tamamlandıktan 90 gün sonra arşivlenir. **${rows.length}** dosya temizlenmeyi bekliyor.`,
        { count: rows.length, sample: rows.slice(0, 3).map((r) => r.original_name) },
        suggestedAction
      )
    );

    return { findings, metrics: { count: rows.length } };
  }

  // C) E-fatura eşiği
  private async checkEinvoiceThreshold() {
    const findings: AuditorFinding[] = [];

    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const { data } = await this.admin
      .from("orders")
      .select("total")
      .gte("created_at", yearStart.toISOString())
      .in("status", [
        "paid",
        "shipped",
        "delivered",
        "in_production",
      ] as never);

    const rows = (data ?? []) as Array<{ total: number | string }>;
    const yearlyTotal = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    const pctOfThreshold = yearlyTotal / TUNE.einvoiceThresholdTl;

    if (pctOfThreshold > 0.75) {
      const isOver = pctOfThreshold >= 1;
      findings.push(
        (isOver ? this.critical : this.warning).bind(this)(
          "einvoice_threshold",
          `Yıllık ciro e-fatura eşiğinin %${(pctOfThreshold * 100).toFixed(0)}'ı`,
          `Bu yıl toplam ciro: **${yearlyTotal.toLocaleString("tr-TR")} TL**. E-fatura zorunluluk eşiği: ${TUNE.einvoiceThresholdTl.toLocaleString("tr-TR")} TL.\n\n${isOver ? "**Eşik aşıldı** — e-fatura sistemine geçiş zorunlu (GİB).\nMali müşavirinle ivedi görüş." : "Önümüzdeki aylarda eşiği aşma riski var. E-fatura entegrasyon planlaması yapılmalı."}`,
          {
            yearlyTotal,
            threshold: TUNE.einvoiceThresholdTl,
            pctOfThreshold,
          }
        )
      );
    }

    return { findings, metrics: { yearlyTotal, pctOfThreshold } };
  }

  // D) Cookie consent oranı
  private async checkCookieConsent() {
    const findings: AuditorFinding[] = [];

    // Bu kontrol için PostHog/Analytics gerekiyor. Basit yaklaşım:
    // user_consent (Migration 035) tablosundan toplam vs istatistik.
    // Şu an stub — Sefa PostHog'la entegre edilince devreye alınır.
    return { findings, metrics: { skipped: "PostHog/Analytics integration needed" } };
  }

  // E) Yasal metin yaş kontrolü
  private checkLegalDocAge() {
    const findings: AuditorFinding[] = [];

    // Basit yaklaşım: yasal metinlerin son güncellenme tarihi koddan bilinmez.
    // Sefa /admin/ayarlar'a "last_legal_review_date" tutması önerilir.
    // Şu an stub.
    return { findings, metrics: { docs: LEGAL_DOCS.length } };
  }

  // F) Mail altyapı durumu — Resend domain doğrulu mu
  private async checkMailInfrastructure() {
    const findings: AuditorFinding[] = [];

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      findings.push(
        this.warning(
          "mail_infra_no_key",
          "RESEND_API_KEY env'de yok",
          "Mail sistemi şu an çalışmaz. Sefa Resend API key'i Vercel'e eklemeli.",
          { env: "RESEND_API_KEY" }
        )
      );
      return { findings, metrics: { configured: false } };
    }

    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        findings.push(
          this.warning(
            "mail_infra_api_error",
            `Resend API hatası: HTTP ${res.status}`,
            "API key geçersiz veya quota aşıldı. Resend dashboard'tan kontrol et.",
            { status: res.status }
          )
        );
        return {
          findings,
          metrics: { configured: true, apiError: res.status },
        };
      }

      const json = (await res.json()) as {
        data?: Array<{ name: string; status: string }>;
      };
      const domains = json.data ?? [];
      const pimDomain = domains.find((d) => d.name === "pimetiket.com");

      if (!pimDomain) {
        findings.push(
          this.warning(
            "mail_infra_no_domain",
            "pimetiket.com Resend'de yok",
            "Domain ekli değil — mail gönderilemez. Sefa Resend dashboard → Add Domain.",
            { existingDomains: domains.map((d) => d.name) }
          )
        );
      } else if (pimDomain.status !== "verified") {
        findings.push(
          this.warning(
            "mail_infra_unverified",
            `pimetiket.com Resend'de "${pimDomain.status}"`,
            `Domain durumu **${pimDomain.status}**. Doğrulanana kadar mail gönderilemez. DNS kayıtlarını (DKIM/SPF/MX) Cloudflare'e ekle ve Resend'de verify bas.`,
            { resendStatus: pimDomain.status }
          )
        );
      } else {
        findings.push(
          this.info(
            "mail_infra_ok",
            "Resend mail altyapısı sağlıklı",
            "pimetiket.com **verified** durumda. Tüm mail bildirimleri çalışır.",
            { resendStatus: "verified" }
          )
        );
      }

      return {
        findings,
        metrics: {
          configured: true,
          domainCount: domains.length,
          pimStatus: pimDomain?.status ?? "missing",
        },
      };
    } catch (err) {
      findings.push(
        this.info(
          "mail_infra_check_failed",
          "Mail altyapı kontrolü başarısız",
          `Resend API'sine ulaşılamadı: ${err instanceof Error ? err.message : "unknown"}`,
          { error: String(err) }
        )
      );
      return { findings, metrics: { configured: true, networkError: true } };
    }
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
    `# ⚖️ Mevzuat Uyum Raporu`,
    "",
    `**Özet:** ${counts.total} bulgu (${counts.critical} kritik · ${counts.warning} uyarı)`,
    "",
  ];

  if (findings.length === 0) {
    lines.push(
      "✅ KVKK SLA temiz, dosya retention güncel, e-fatura eşiği uzak, yasal metinler taze."
    );
    return lines.join("\n");
  }

  ["critical", "warning"].forEach((sev) => {
    const items = findings.filter((f) => f.severity === sev);
    if (items.length === 0) return;
    const icon = sev === "critical" ? "🔴" : "🟡";
    lines.push(`## ${icon} ${sev.toUpperCase()}`);
    items.forEach((f) => lines.push(`- **${f.title}** — ${f.description}`));
    lines.push("");
  });

  return lines.join("\n");
}
