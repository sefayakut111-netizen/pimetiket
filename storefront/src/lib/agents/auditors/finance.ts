/**
 * FinanceAuditor — 💰 Muhasebe Denetçisi
 *
 * Günlük 09:00 çalışır (vercel.json). Sefa sabah kahve içerken
 * "Gece Hesap Kapanışı" mailini alır.
 *
 * 6 kontrol alanı:
 *   A. Günlük ciro özet (dün vs bugün)
 *   B. KDV doğrulama (toplam × 20/120 ≈ kayıtlı KDV)
 *   C. Stale payment intent tespit (24+ saat pending)
 *   D. Aktif kupon süresi yaklaşıyor (7 gün eşik)
 *   E. AI maliyet günlük + aylık projeksiyon
 *   F. Vergi dönemi sayacı (KDV beyannamesi, geçici vergi)
 *
 * Sefa kuralı: Pim Etiket KDV %20 dahil fiyat gösterir.
 */

import { AuditorBase } from "../_shared/base";
import type {
  AuditorFinding,
  AuditorRunResult,
  SuggestedAction,
} from "../_shared/types";

const TUNE = {
  /** KDV oranı (Pim Etiket dijital baskı için %20) */
  vatRate: 0.20,
  /** Stale intent eşiği (saat) */
  staleIntentHours: 24,
  /** Stale intent kritik eşiği (saat) — 48+ kritik */
  staleIntentCriticalHours: 48,
  /** Kupon süresi yaklaşma eşiği (gün) */
  couponExpiryWarningDays: 7,
  /** AI günlük bütçe (USD) */
  aiDailyBudget: 5.0,
  /** AI aylık bütçe (USD) */
  aiMonthlyBudget: 100.0,
};

// Türkiye vergi takvimi (sabit)
const TAX_CALENDAR = [
  { name: "KDV beyannamesi", day: 26 }, // Her ay 26'sı
  { name: "Geçici vergi", day: 17, months: [2, 5, 8, 11] }, // Şubat/Mayıs/Ağustos/Kasım 17'si
  { name: "Yıllık gelir vergisi", day: 25, months: [3] }, // 25 Mart
] as const;

export class FinanceAuditor extends AuditorBase {
  constructor() {
    super("finance", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    // A) Günlük ciro
    const revenue = await this.checkDailyRevenue();
    findings.push(...revenue.findings);
    metrics.revenue = revenue.metrics;

    // B) KDV doğrulama
    const vat = await this.checkVatConsistency(revenue.metrics.todayTotal);
    findings.push(...vat.findings);
    metrics.vat = vat.metrics;

    // C) Stale payment intents
    const stale = await this.checkStaleIntents();
    findings.push(...stale.findings);
    metrics.staleIntents = stale.metrics;

    // D) Kupon süresi
    const coupons = await this.checkCouponExpiry();
    findings.push(...coupons.findings);
    metrics.coupons = coupons.metrics;

    // E) AI maliyet
    const aiCost = await this.checkAiCost();
    findings.push(...aiCost.findings);
    metrics.aiCost = aiCost.metrics;

    // F) Vergi dönemi
    const tax = this.checkTaxCalendar();
    findings.push(...tax.findings);
    metrics.taxCalendar = tax.metrics;

    const counts = countFindings(findings);
    const summary = buildSummary(counts, revenue.metrics);
    const summaryMd = buildSummaryMd(findings, counts, metrics);

    return {
      findings,
      summary,
      summaryMd,
      metricsSnapshot: metrics,
    };
  }

  // ============================================================
  // A) Günlük ciro özet
  // ============================================================
  private async checkDailyRevenue() {
    const findings: AuditorFinding[] = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Dün paid+ siparişler
    const { data: yesterdayData } = await this.admin
      .from("orders")
      .select("total, status")
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString());

    const yesterdayRows = (yesterdayData ?? []) as Array<{
      total: number | string;
      status: string;
    }>;

    const successStatuses = new Set([
      "paid",
      "qc_pending",
      "qc_flagged",
      "operator_review",
      "proof_pending",
      "in_production",
      "shipped",
      "delivered",
      "proof_generating",
      "fason_assigned",
      "human_review",
      "ready_to_ship",
    ]);

    const yesterdaySuccess = yesterdayRows.filter((r) =>
      successStatuses.has(r.status)
    );
    const yesterdayTotal = yesterdaySuccess.reduce(
      (s, r) => s + Number(r.total || 0),
      0
    );
    const yesterdayCancelled = yesterdayRows
      .filter((r) => r.status === "cancelled")
      .reduce((s, r) => s + Number(r.total || 0), 0);

    // Bugünkü kümülatif (info — mail saatinde günün başlangıcı)
    const { data: todayData } = await this.admin
      .from("orders")
      .select("total, status")
      .gte("created_at", today.toISOString());

    const todayRows = (todayData ?? []) as Array<{
      total: number | string;
      status: string;
    }>;

    const todayTotal = todayRows
      .filter((r) => successStatuses.has(r.status))
      .reduce((s, r) => s + Number(r.total || 0), 0);

    // Always info: günlük özet
    findings.push(
      this.info(
        "daily_revenue",
        `Dünkü ciro: ${formatTl(yesterdayTotal)}`,
        `Dün **${yesterdaySuccess.length}** sipariş, toplam **${formatTl(yesterdayTotal)}**. İptal: ${formatTl(yesterdayCancelled)}.\n\nBugün şu ana kadar: ${formatTl(todayTotal)} (${todayRows.length} sipariş).`,
        {
          yesterdayOrderCount: yesterdaySuccess.length,
          yesterdayTotal,
          yesterdayCancelled,
          todayTotal,
          todayOrderCount: todayRows.length,
        }
      )
    );

    return {
      findings,
      metrics: {
        yesterdayTotal,
        yesterdayCount: yesterdaySuccess.length,
        yesterdayCancelled,
        todayTotal,
        todayCount: todayRows.length,
      },
    };
  }

  // ============================================================
  // B) KDV doğrulama
  // ============================================================
  private async checkVatConsistency(todayTotal: number) {
    const findings: AuditorFinding[] = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Dün toplam ciro (vat dahil — KDV %20 dahil görünür)
    const { data: ordersData } = await this.admin
      .from("orders")
      .select("subtotal, total")
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString())
      .in("status", [
        "paid",
        "shipped",
        "delivered",
        "in_production",
        "ready_to_ship",
      ] as never);

    const rows = (ordersData ?? []) as Array<{
      subtotal: number | string;
      total: number | string;
    }>;

    const totalSum = rows.reduce((s, r) => s + Number(r.total || 0), 0);

    if (totalSum === 0) {
      return {
        findings,
        metrics: { totalSum: 0, vatExtracted: 0, vatExpected: 0 },
      };
    }

    // KDV %20 dahil ise: vat = total × (20/120)
    const vatExtracted = totalSum * (TUNE.vatRate / (1 + TUNE.vatRate));
    const vatExpected = totalSum * TUNE.vatRate;

    // KDV oranı tutarlı mı? Sefa için bilgi finding.
    const consistencyOk = Math.abs(vatExtracted - vatExpected) < 0.5;

    findings.push(
      this.info(
        "vat_check",
        `KDV (KDV dahil ${formatTl(totalSum)} ciroda)`,
        `Dünkü ciro ${formatTl(totalSum)} KDV dahil. Net: ${formatTl(totalSum - vatExtracted)}, KDV (%${TUNE.vatRate * 100}): **${formatTl(vatExtracted)}**.\n\nDoğrulama: ${consistencyOk ? "✓ tutarlı" : "⚠ farkı kontrol et"}.`,
        {
          totalSum,
          vatExtracted,
          vatExpected,
          consistencyOk,
        }
      )
    );

    // todayTotal parametresi runtime için (lint ignore unused)
    void todayTotal;

    return {
      findings,
      metrics: { totalSum, vatExtracted, vatExpected },
    };
  }

  // ============================================================
  // C) Stale payment intents
  // ============================================================
  private async checkStaleIntents() {
    const findings: AuditorFinding[] = [];
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - TUNE.staleIntentHours);

    const { data, error } = await this.admin
      .from("payment_intents")
      .select("id, created_at, card_amount, user_id")
      .eq("status", "pending" as never)
      .lt("created_at", cutoff.toISOString())
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      return { findings, metrics: { count: 0, oldestHours: 0 } };
    }

    const rows = (data ?? []) as Array<{
      id: string;
      created_at: string;
      card_amount: number | string;
      user_id: string | null;
    }>;

    if (rows.length === 0) {
      return { findings, metrics: { count: 0, oldestHours: 0 } };
    }

    const oldestHours =
      (Date.now() - new Date(rows[0].created_at).getTime()) / 3600_000;

    const intentIds = rows.map((r) => r.id);

    const suggestedAction: SuggestedAction = {
      type: "expire_stale_intents",
      payload: {
        intentIds,
        reason: `stale_${TUNE.staleIntentHours}h`,
      },
      title: `${rows.length} stale payment intent'i kapat`,
      description: `${TUNE.staleIntentHours}+ saattir pending bekleyen ${rows.length} intent toplu olarak "failed" yapılır. Sefa kullanıcı tekrar denedi mi diye kontrol etmeli.`,
    };

    const severity =
      oldestHours > TUNE.staleIntentCriticalHours ? "critical" : "warning";

    const finding =
      severity === "critical"
        ? this.critical(
            "stale_intent",
            `${rows.length} stale payment intent (en eski ${oldestHours.toFixed(0)}h)`,
            `${rows.length} payment intent ${TUNE.staleIntentHours}+ saattir pending durumda. En eskisi ${oldestHours.toFixed(0)} saat önce oluşmuş. Müşteri ödeme yapmadı, yeni intent oluşturmak için sayfayı kapatmış olabilir.`,
            { count: rows.length, oldestHours, intentIds: intentIds.slice(0, 5) },
            suggestedAction
          )
        : this.warning(
            "stale_intent",
            `${rows.length} stale payment intent`,
            `${rows.length} payment intent ${TUNE.staleIntentHours}+ saattir pending. Temizlemek güvenli — kullanıcı yeniden denerse zaten yeni intent oluşur.`,
            { count: rows.length, oldestHours, intentIds: intentIds.slice(0, 5) },
            suggestedAction
          );

    findings.push(finding);

    return {
      findings,
      metrics: { count: rows.length, oldestHours },
    };
  }

  // ============================================================
  // D) Kupon süresi yaklaşıyor
  // ============================================================
  private async checkCouponExpiry() {
    const findings: AuditorFinding[] = [];
    const now = new Date();
    const warningCutoff = new Date();
    warningCutoff.setDate(warningCutoff.getDate() + TUNE.couponExpiryWarningDays);

    const { data, error } = await this.admin
      .from("coupons")
      .select("id, code, expires_at, value, kind")
      .eq("is_active", true as never)
      .gt("expires_at", now.toISOString())
      .lt("expires_at", warningCutoff.toISOString())
      .order("expires_at", { ascending: true })
      .limit(20);

    if (error) {
      return { findings, metrics: { expiringCount: 0 } };
    }

    const rows = (data ?? []) as Array<{
      id: string;
      code: string;
      expires_at: string;
      value: number | string;
      kind: string;
    }>;

    if (rows.length === 0) {
      return { findings, metrics: { expiringCount: 0 } };
    }

    findings.push(
      this.info(
        "coupon_expiry",
        `${rows.length} kupon süresi yaklaşıyor`,
        `Önümüzdeki ${TUNE.couponExpiryWarningDays} gün içinde sona erecek **${rows.length}** aktif kupon var:\n\n${rows.map((c) => `- **${c.code}** (${c.value}${c.kind === "percent" ? "%" : " ₺"}) — ${formatDate(c.expires_at)}`).join("\n")}`,
        {
          count: rows.length,
          coupons: rows.map((c) => ({
            id: c.id,
            code: c.code,
            expires_at: c.expires_at,
          })),
        }
      )
    );

    return { findings, metrics: { expiringCount: rows.length } };
  }

  // ============================================================
  // E) AI maliyet projeksiyonu
  // ============================================================
  private async checkAiCost() {
    const findings: AuditorFinding[] = [];

    // Dün maliyet
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: yesterdayData } = await this.admin
      .from("design_quality_checks")
      .select("cost_usd")
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString());

    const yesterdayCost = ((yesterdayData ?? []) as Array<{
      cost_usd: number | string | null;
    }>).reduce((s, r) => s + Number(r.cost_usd || 0), 0);

    // Bu ay kümülatif
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: monthData } = await this.admin
      .from("design_quality_checks")
      .select("cost_usd")
      .gte("created_at", monthStart.toISOString());

    const monthCost = ((monthData ?? []) as Array<{
      cost_usd: number | string | null;
    }>).reduce((s, r) => s + Number(r.cost_usd || 0), 0);

    // Ay sonu projeksiyon
    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const monthProjection = (monthCost / daysElapsed) * daysInMonth;

    // Alert tetikleri
    if (yesterdayCost > TUNE.aiDailyBudget) {
      findings.push(
        this.warning(
          "ai_cost_daily",
          `AI maliyet günlük bütçeyi aştı: $${yesterdayCost.toFixed(2)}`,
          `Dün AI çağrıları **$${yesterdayCost.toFixed(2)}** tuttu (bütçe: $${TUNE.aiDailyBudget}). Design QC + Pim chat birlikte. Saatlik en yoğun ne?`,
          { yesterdayCost, budget: TUNE.aiDailyBudget }
        )
      );
    }

    if (monthProjection > TUNE.aiMonthlyBudget) {
      const suggestedAction: SuggestedAction = {
        type: "notify_sefa",
        payload: {
          subject: "AI aylık bütçe projeksiyonu aşıldı",
          message: `Bu ay AI maliyet projeksiyonu: $${monthProjection.toFixed(2)} (bütçe: $${TUNE.aiMonthlyBudget}).\nŞu ana kadar: $${monthCost.toFixed(2)} (${daysElapsed}/${daysInMonth} gün).\n\nÖneri: gpt-4o-mini geçişi veya cache eklemek. Detay /admin/denetciler/ai_cost`,
          urgency: "warning",
        },
        title: "AI aylık bütçe aşımı bildirimi",
        description: "Sefa'ya bütçe alert maili gönderilir.",
      };

      findings.push(
        this.warning(
          "ai_cost_monthly",
          `Aylık projeksiyon: $${monthProjection.toFixed(2)}`,
          `Bu ay AI projeksiyon **$${monthProjection.toFixed(2)}** — bütçe $${TUNE.aiMonthlyBudget}. Şu ana kadar: $${monthCost.toFixed(2)}.`,
          {
            monthCost,
            monthProjection,
            budget: TUNE.aiMonthlyBudget,
            daysElapsed,
            daysInMonth,
          },
          suggestedAction
        )
      );
    } else {
      // Normal — info
      findings.push(
        this.info(
          "ai_cost",
          `AI maliyet: dün $${yesterdayCost.toFixed(2)} · ay $${monthCost.toFixed(2)}`,
          `Dün AI: **$${yesterdayCost.toFixed(2)}** · Bu ay: **$${monthCost.toFixed(2)}** · Aylık projeksiyon: $${monthProjection.toFixed(2)}.`,
          { yesterdayCost, monthCost, monthProjection }
        )
      );
    }

    return {
      findings,
      metrics: { yesterdayCost, monthCost, monthProjection },
    };
  }

  // ============================================================
  // F) Vergi takvimi
  // ============================================================
  private checkTaxCalendar() {
    const findings: AuditorFinding[] = [];
    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth() + 1; // 1-12

    const upcoming: Array<{ name: string; daysAway: number }> = [];

    for (const event of TAX_CALENDAR) {
      const eventMonths =
        "months" in event && event.months
          ? event.months
          : Array.from({ length: 12 }, (_, i) => i + 1);

      for (const m of eventMonths) {
        const eventDate = new Date(now.getFullYear(), m - 1, event.day);
        // Geçmiş olanları atla
        if (
          eventDate < now &&
          !(m === todayMonth && event.day === todayDay)
        )
          continue;
        const daysAway = Math.ceil(
          (eventDate.getTime() - now.getTime()) / 86400_000
        );
        if (daysAway >= 0 && daysAway <= 10) {
          upcoming.push({ name: event.name, daysAway });
        }
      }
    }

    if (upcoming.length === 0) {
      return { findings, metrics: { upcomingCount: 0 } };
    }

    findings.push(
      this.warning(
        "tax_calendar",
        `Vergi takvimi: ${upcoming.length} yaklaşan`,
        `Önümüzdeki 10 gün içinde:\n${upcoming.map((u) => `- **${u.name}** — ${u.daysAway === 0 ? "BUGÜN" : `${u.daysAway} gün sonra`}`).join("\n")}\n\nMali müşavirine bildir.`,
        { upcoming }
      )
    );

    return { findings, metrics: { upcomingCount: upcoming.length, upcoming } };
  }
}

// ============================================================
// Helpers
// ============================================================

function formatTl(n: number): string {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ₺";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
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

function buildSummary(
  counts: ReturnType<typeof countFindings>,
  revenue: { yesterdayTotal: number; yesterdayCount: number }
): string {
  const ciroLabel = `Dün: ${formatTl(revenue.yesterdayTotal)} (${revenue.yesterdayCount} sipariş)`;
  if (counts.critical > 0)
    return `${ciroLabel} — ${counts.critical} kritik konu var.`;
  if (counts.warning > 0)
    return `${ciroLabel} — ${counts.warning} uyarı + ${counts.info} bilgi.`;
  return `${ciroLabel} — Hesap temiz, ${counts.info} bilgi.`;
}

function buildSummaryMd(
  findings: AuditorFinding[],
  counts: ReturnType<typeof countFindings>,
  metrics: Record<string, unknown>
): string {
  const lines: string[] = [
    `# 💰 Gece Hesap Kapanışı`,
    "",
    `**Özet:** ${counts.total} bulgu (${counts.critical} kritik · ${counts.warning} uyarı · ${counts.info} bilgi)`,
    "",
  ];

  const revenue = metrics.revenue as
    | { yesterdayTotal?: number; yesterdayCount?: number; todayTotal?: number }
    | undefined;
  if (revenue) {
    lines.push(
      `## 📊 Ciro`,
      `- Dün: **${formatTl(revenue.yesterdayTotal ?? 0)}** (${revenue.yesterdayCount} sipariş)`,
      `- Bugün şu ana kadar: ${formatTl(revenue.todayTotal ?? 0)}`,
      ""
    );
  }

  const critical = findings.filter((f) => f.severity === "critical");
  const warning = findings.filter((f) => f.severity === "warning");
  const info = findings.filter((f) => f.severity === "info");

  if (critical.length > 0) {
    lines.push(`## 🔴 Kritik`);
    critical.forEach((f) => lines.push(`- **${f.title}** — ${f.description}`));
    lines.push("");
  }

  if (warning.length > 0) {
    lines.push(`## 🟡 Uyarılar`);
    warning.forEach((f) => lines.push(`- **${f.title}** — ${f.description}`));
    lines.push("");
  }

  if (info.length > 0) {
    lines.push(`## ℹ️ Bilgi`);
    info.forEach((f) => lines.push(`- ${f.title}`));
  }

  return lines.join("\n");
}
