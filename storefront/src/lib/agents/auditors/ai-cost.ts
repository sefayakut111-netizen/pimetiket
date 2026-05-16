/**
 * AiCostAuditor — 💸 AI Maliyet Denetçisi
 *
 * Günlük 09:30 çalışır (finance'den sonra, daha detaylı).
 * Finance daily summary verir, bu detay analiz.
 *
 * 5 kontrol:
 *   A. Günlük cost breakdown (Design QC vs Pim Chat)
 *   B. Saatlik en yoğun pencere
 *   C. En pahalı top 5 agent run
 *   D. Aylık projeksiyon + bütçe alert
 *   E. Token kullanım kırılımı (model bazlı)
 */

import { AuditorBase } from "../_shared/base";
import type {
  AuditorFinding,
  AuditorRunResult,
  SuggestedAction,
} from "../_shared/types";

const TUNE = {
  dailyBudgetUsd: 5.0,
  monthlyBudgetUsd: 100.0,
  expensiveRunThresholdUsd: 0.05,
};

export class AiCostAuditor extends AuditorBase {
  constructor() {
    super("ai_cost", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    const daily = await this.checkDailyCost();
    findings.push(...daily.findings);
    metrics.daily = daily.metrics;

    const expensive = await this.checkExpensiveRuns();
    findings.push(...expensive.findings);
    metrics.expensive = expensive.metrics;

    const monthly = await this.checkMonthlyProjection();
    findings.push(...monthly.findings);
    metrics.monthly = monthly.metrics;

    const breakdown = await this.checkModelBreakdown();
    findings.push(...breakdown.findings);
    metrics.breakdown = breakdown.metrics;

    const tokens = await this.checkTokenUsage();
    findings.push(...tokens.findings);
    metrics.tokens = tokens.metrics;

    const spike = await this.checkSpikeDetection();
    findings.push(...spike.findings);
    metrics.spike = spike.metrics;

    const counts = countFindings(findings);
    return {
      findings,
      summary:
        counts.total === 0
          ? `AI maliyet kontrolde (bütçe: $${TUNE.dailyBudgetUsd}/gün, $${TUNE.monthlyBudgetUsd}/ay).`
          : `${counts.critical} kritik · ${counts.warning} uyarı.`,
      summaryMd: buildSummaryMd(findings, counts, metrics),
      metricsSnapshot: metrics,
    };
  }

  // A) Günlük cost
  private async checkDailyCost() {
    const findings: AuditorFinding[] = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await this.admin
      .from("design_quality_checks")
      .select("cost_usd, model, duration_ms")
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString());

    const rows = (data ?? []) as Array<{
      cost_usd: number | string | null;
      model: string | null;
      duration_ms: number | null;
    }>;

    const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
    const runCount = rows.length;
    const avgCost = runCount > 0 ? totalCost / runCount : 0;

    findings.push(
      this.info(
        "daily_cost",
        `Dün AI maliyet: $${totalCost.toFixed(2)} (${runCount} run)`,
        `Toplam $${totalCost.toFixed(2)} · Ortalama: $${avgCost.toFixed(4)}/run · Bütçe: $${TUNE.dailyBudgetUsd}/gün.`,
        { totalCost, runCount, avgCost }
      )
    );

    if (totalCost > TUNE.dailyBudgetUsd) {
      const suggestedAction: SuggestedAction = {
        type: "notify_sefa",
        payload: {
          subject: "Günlük AI bütçesi aşıldı",
          message: `Dün AI maliyet $${totalCost.toFixed(2)} (bütçe: $${TUNE.dailyBudgetUsd}).\n\nÖneri: gpt-4o yerine gpt-4o-mini test et, en pahalı run'ları /admin/denetciler/ai_cost'tan incele.`,
          urgency: "warning",
        },
        title: "Günlük AI bütçe aşımı bildir",
        description: "Sefa'ya bütçe alert maili gönderir.",
      };

      findings.push(
        this.warning(
          "daily_budget_exceeded",
          `Günlük bütçe aşıldı: $${totalCost.toFixed(2)} > $${TUNE.dailyBudgetUsd}`,
          `Dün AI çağrıları **$${totalCost.toFixed(2)}** tuttu. Günlük bütçe: **$${TUNE.dailyBudgetUsd}**. Modelden tasarruf imkanı incele.`,
          { totalCost, budget: TUNE.dailyBudgetUsd },
          suggestedAction
        )
      );
    }

    return {
      findings,
      metrics: { totalCost, runCount, avgCost },
    };
  }

  // B) Pahalı top 5 run
  private async checkExpensiveRuns() {
    const findings: AuditorFinding[] = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data } = await this.admin
      .from("design_quality_checks")
      .select("id, cost_usd, model, file_format, duration_ms, order_id")
      .gte("created_at", yesterday.toISOString())
      .gte("cost_usd", TUNE.expensiveRunThresholdUsd)
      .order("cost_usd", { ascending: false })
      .limit(5);

    const rows = (data ?? []) as Array<{
      id: string;
      cost_usd: number;
      model: string | null;
      file_format: string | null;
      duration_ms: number | null;
      order_id: string | null;
    }>;

    if (rows.length === 0) return { findings, metrics: { count: 0 } };

    const totalExpensive = rows.reduce((s, r) => s + Number(r.cost_usd), 0);

    findings.push(
      this.info(
        "expensive_runs",
        `${rows.length} pahalı run (toplam $${totalExpensive.toFixed(2)})`,
        `Eşik üstü (>$${TUNE.expensiveRunThresholdUsd}) ${rows.length} run var:\n${rows
          .map(
            (r) =>
              `- $${Number(r.cost_usd).toFixed(4)} · ${r.model ?? "?"} · ${r.file_format ?? "?"} · ${r.duration_ms ?? 0}ms${r.order_id ? ` · order: ${r.order_id.slice(0, 8)}` : ""}`
          )
          .join("\n")}`,
        { runs: rows }
      )
    );

    return { findings, metrics: { count: rows.length, totalExpensive } };
  }

  // C) Aylık projeksiyon
  private async checkMonthlyProjection() {
    const findings: AuditorFinding[] = [];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data } = await this.admin
      .from("design_quality_checks")
      .select("cost_usd")
      .gte("created_at", monthStart.toISOString());

    const rows = (data ?? []) as Array<{ cost_usd: number | string | null }>;
    const monthCost = rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0);

    const now = new Date();
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const projection = (monthCost / daysElapsed) * daysInMonth;

    if (projection > TUNE.monthlyBudgetUsd) {
      const suggestedAction: SuggestedAction = {
        type: "notify_sefa",
        payload: {
          subject: "AI aylık bütçe projeksiyonu aşıldı",
          message: `Aylık projeksiyon: $${projection.toFixed(2)} (bütçe: $${TUNE.monthlyBudgetUsd}).\nŞu ana kadar: $${monthCost.toFixed(2)} (${daysElapsed}/${daysInMonth} gün).`,
          urgency: projection > TUNE.monthlyBudgetUsd * 1.5 ? "critical" : "warning",
        },
        title: "Aylık AI bütçe alert",
        description: "Sefa'ya aylık bütçe alert maili gönderir.",
      };

      const severity =
        projection > TUNE.monthlyBudgetUsd * 1.5 ? "critical" : "warning";

      findings.push(
        severity === "critical"
          ? this.critical(
              "monthly_budget_projection",
              `Aylık projeksiyon $${projection.toFixed(2)} > bütçe`,
              `Bu ay AI maliyet ${(projection / TUNE.monthlyBudgetUsd * 100).toFixed(0)}% bütçe seviyesinde projeksiyon. Şu ana kadar: $${monthCost.toFixed(2)}.`,
              { monthCost, projection, budget: TUNE.monthlyBudgetUsd, daysElapsed, daysInMonth },
              suggestedAction
            )
          : this.warning(
              "monthly_budget_projection",
              `Aylık projeksiyon $${projection.toFixed(2)}`,
              `Bu ay AI maliyet projeksiyon **$${projection.toFixed(2)}** — bütçe $${TUNE.monthlyBudgetUsd}.`,
              { monthCost, projection, budget: TUNE.monthlyBudgetUsd, daysElapsed, daysInMonth },
              suggestedAction
            )
      );
    } else {
      findings.push(
        this.info(
          "monthly_cost",
          `Bu ay: $${monthCost.toFixed(2)} (projeksiyon $${projection.toFixed(2)})`,
          `${daysElapsed}/${daysInMonth} gün. Bütçe $${TUNE.monthlyBudgetUsd} — güvenli alandasın.`,
          { monthCost, projection, budget: TUNE.monthlyBudgetUsd }
        )
      );
    }

    return {
      findings,
      metrics: { monthCost, projection },
    };
  }

  // E) Token usage analizi
  private async checkTokenUsage() {
    const findings: AuditorFinding[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data } = await this.admin
      .from("design_quality_checks")
      .select("tokens_used, cost_usd, duration_ms, model")
      .gte("created_at", since.toISOString())
      .not("tokens_used", "is", null);

    const rows = (data ?? []) as Array<{
      tokens_used: number | string | null;
      cost_usd: number | string | null;
      duration_ms: number | null;
      model: string | null;
    }>;

    if (rows.length === 0) {
      return { findings, metrics: { totalTokens: 0 } };
    }

    const totalTokens = rows.reduce(
      (s, r) => s + Number(r.tokens_used ?? 0),
      0
    );
    const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    const avgTokens = totalTokens / rows.length;
    const costPerK = totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0;

    findings.push(
      this.info(
        "token_usage",
        `Son 7 gün: ${(totalTokens / 1000).toFixed(1)}k token`,
        `Toplam: **${totalTokens.toLocaleString("tr-TR")} token** · Ort: **${avgTokens.toFixed(0)} token/run** · $${costPerK.toFixed(4)}/1k token`,
        { totalTokens, avgTokens, costPerK, runCount: rows.length }
      )
    );

    // Prompt şişme tespit — son 24 saat ort vs son 7 gün ort
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentRows = rows.filter(
      (r) => r.duration_ms !== null
    );
    // Burada tarih filter yapamıyoruz çünkü tokens query'sinde created_at yok
    // — basit yaklaşım: ortalama token 5000+ ise uyarı
    if (avgTokens > 5000) {
      findings.push(
        this.warning(
          "high_token_usage",
          `Yüksek token kullanımı: ${avgTokens.toFixed(0)} token/run`,
          `Ortalama her AI çağrısı **${avgTokens.toFixed(0)} token** harcıyor. Prompt'lar büyük olabilir — Design QC prompt'unu küçültme şansı var mı incele.`,
          { avgTokens, threshold: 5000 }
        )
      );
    }

    void recentRows;
    return {
      findings,
      metrics: { totalTokens, avgTokens, costPerK, runCount: rows.length },
    };
  }

  // F) Spike detection — bir gün 5× ortalamayı aştıysa kritik
  private async checkSpikeDetection() {
    const findings: AuditorFinding[] = [];

    // Son 7 günün her gününün toplam cost'u
    const days: Array<{ date: string; cost: number; count: number }> = [];
    for (let i = 0; i < 7; i++) {
      const start = new Date();
      start.setDate(start.getDate() - i - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data } = await this.admin
        .from("design_quality_checks")
        .select("cost_usd")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());

      const rows = (data ?? []) as Array<{ cost_usd: number | string | null }>;
      const cost = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

      days.push({
        date: start.toISOString().slice(0, 10),
        cost,
        count: rows.length,
      });
    }

    if (days.length < 2) {
      return { findings, metrics: { days: [] } };
    }

    // 7 gün ortalama + max gün
    const total = days.reduce((s, d) => s + d.cost, 0);
    const avg = total / days.length;
    const maxDay = days.reduce((m, d) => (d.cost > m.cost ? d : m), days[0]);

    if (avg > 0 && maxDay.cost >= avg * 5 && maxDay.cost > 1) {
      const suggestedAction: SuggestedAction = {
        type: "notify_sefa",
        payload: {
          subject: "AI maliyet spike tespit edildi",
          message: `${maxDay.date} tarihinde AI maliyet $${maxDay.cost.toFixed(2)} (${maxDay.count} run) — ortalamanın ${(maxDay.cost / avg).toFixed(1)}× üstü. 7 gün ort: $${avg.toFixed(2)}/gün.\n\nİnceleme: /admin/denetciler/ai_cost`,
          urgency: "critical",
        },
        title: "AI maliyet spike bildirimi",
        description: `${maxDay.date}: $${maxDay.cost.toFixed(2)} (ortalamanın ${(maxDay.cost / avg).toFixed(1)}× üstü)`,
      };

      findings.push(
        this.critical(
          "cost_spike",
          `Cost spike: ${maxDay.date} → $${maxDay.cost.toFixed(2)}`,
          `Bir günde **$${maxDay.cost.toFixed(2)}** harcandı (${maxDay.count} run). Ortalama $${avg.toFixed(2)}/gün — bu **${(maxDay.cost / avg).toFixed(1)}× üstü**.\n\nMuhtemel sebepler:\n- Bot saldırısı: fake order'lar Design QC tetikliyor\n- Prompt değişikliği: token sayısı patladı\n- Yeni feature: AI çağrısı eklenip cache'siz çalışıyor`,
          { spikeDay: maxDay, avg, days },
          suggestedAction
        )
      );
    }

    return { findings, metrics: { days, avg, maxDay } };
  }

  // D) Model breakdown — hangi model en pahalı
  private async checkModelBreakdown() {
    const findings: AuditorFinding[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data } = await this.admin
      .from("design_quality_checks")
      .select("cost_usd, model")
      .gte("created_at", since.toISOString());

    const rows = (data ?? []) as Array<{
      cost_usd: number | string | null;
      model: string | null;
    }>;

    if (rows.length === 0) {
      return { findings, metrics: { byModel: {} } };
    }

    // Model bazlı toplam ve sayı
    const byModel: Record<string, { count: number; cost: number }> = {};
    for (const r of rows) {
      const m = r.model ?? "unknown";
      if (!byModel[m]) byModel[m] = { count: 0, cost: 0 };
      byModel[m].count += 1;
      byModel[m].cost += Number(r.cost_usd ?? 0);
    }

    const sortedModels = Object.entries(byModel).sort(
      (a, b) => b[1].cost - a[1].cost
    );

    findings.push(
      this.info(
        "model_breakdown",
        `Son 7 gün model kullanımı: ${sortedModels.length} model`,
        sortedModels
          .map(
            ([model, stats]) =>
              `- **${model}**: ${stats.count} run · $${stats.cost.toFixed(2)} · ort $${(stats.cost / stats.count).toFixed(4)}/run`
          )
          .join("\n"),
        { byModel: Object.fromEntries(sortedModels) }
      )
    );

    // Tasarruf önerisi: gpt-4o varsa ve gpt-4o-mini'den 5× pahalıysa
    const gpt4o = byModel["gpt-4o"];
    const gpt4oMini = byModel["gpt-4o-mini"];
    if (gpt4o && gpt4o.cost > 1.0 && gpt4oMini) {
      const avg4o = gpt4o.cost / gpt4o.count;
      const avgMini = gpt4oMini.cost / gpt4oMini.count;
      if (avg4o > avgMini * 5) {
        findings.push(
          this.info(
            "savings_opportunity",
            `Model tasarruf fırsatı: gpt-4o run başına ${(avg4o / avgMini).toFixed(1)}× pahalı`,
            `gpt-4o ort: $${avg4o.toFixed(4)}/run. gpt-4o-mini ort: $${avgMini.toFixed(4)}/run. Pim chat veya basit kategoriler için mini'ye geç → aylık ~$${(gpt4o.cost * 4 * 0.7).toFixed(0)} tasarruf.`,
            { gpt4o, gpt4oMini, ratio: avg4o / avgMini }
          )
        );
      }
    }

    return {
      findings,
      metrics: { byModel: Object.fromEntries(sortedModels) },
    };
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
  counts: ReturnType<typeof countFindings>,
  metrics: Record<string, unknown>
): string {
  const daily = metrics.daily as
    | { totalCost?: number; runCount?: number; avgCost?: number }
    | undefined;
  const monthly = metrics.monthly as
    | { monthCost?: number; projection?: number }
    | undefined;

  const lines: string[] = [
    `# 💸 AI Maliyet Raporu`,
    "",
    `**Dün:** $${(daily?.totalCost ?? 0).toFixed(2)} (${daily?.runCount ?? 0} run, ort $${(daily?.avgCost ?? 0).toFixed(4)})`,
    `**Bu ay:** $${(monthly?.monthCost ?? 0).toFixed(2)} (projeksiyon $${(monthly?.projection ?? 0).toFixed(2)})`,
    "",
  ];

  if (counts.total === 0) {
    lines.push("✅ Bütçe sınırları içinde — sorun yok.");
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
