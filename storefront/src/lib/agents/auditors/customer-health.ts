/**
 * CustomerHealthAuditor — 😊 Müşteri Memnuniyeti Denetçisi
 *
 * Haftalık Pazartesi 10:00. Müşteri sağlığı + büyüme metrikleri.
 *
 * 4 kontrol:
 *   A. Yorum skoru trendi (geçen hafta vs bu hafta)
 *   B. İade/iptal oranı (cancelled / paid+)
 *   C. Tekrar müşteri oranı (2+ orders user'lar)
 *   D. Aktif sepet sayısı (cart_items > 0, paid order yok son 7 gün)
 */

import { AuditorBase } from "../_shared/base";
import type { AuditorFinding, AuditorRunResult } from "../_shared/types";

const TUNE = {
  abandonmentWarningRate: 0.70, // %70+ abandonment uyarı
  cancellationWarningRate: 0.15, // %15+ iptal uyarı
  minReviewsForTrend: 5,
  ratingDropThreshold: 0.5, // 0.5 yıldız düşüş uyarı
};

export class CustomerHealthAuditor extends AuditorBase {
  constructor() {
    super("customer_health", "v1");
  }

  protected async runChecks(): Promise<AuditorRunResult> {
    const findings: AuditorFinding[] = [];
    const metrics: Record<string, unknown> = {};

    const reviews = await this.checkReviewTrend();
    findings.push(...reviews.findings);
    metrics.reviews = reviews.metrics;

    const cancellation = await this.checkCancellationRate();
    findings.push(...cancellation.findings);
    metrics.cancellation = cancellation.metrics;

    const repeat = await this.checkRepeatCustomerRate();
    findings.push(...repeat.findings);
    metrics.repeat = repeat.metrics;

    const abandonment = await this.checkCartAbandonment();
    findings.push(...abandonment.findings);
    metrics.abandonment = abandonment.metrics;

    const aov = await this.checkAverageOrderValue();
    findings.push(...aov.findings);
    metrics.aov = aov.metrics;

    const segment = await this.checkSegmentMix();
    findings.push(...segment.findings);
    metrics.segment = segment.metrics;

    const counts = countFindings(findings);
    return {
      findings,
      summary:
        counts.total === 0
          ? "Müşteri memnuniyeti sağlam."
          : `${counts.warning} dikkat noktası tespit edildi.`,
      summaryMd: buildSummaryMd(findings, counts, metrics),
      metricsSnapshot: metrics,
    };
  }

  // A) Yorum skoru trendi
  private async checkReviewTrend() {
    const findings: AuditorFinding[] = [];
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 14);

    const { data: thisWeekData } = await this.admin
      .from("product_reviews")
      .select("rating")
      .gte("created_at", thisWeek.toISOString())
      .eq("is_published", true as never);

    const { data: lastWeekData } = await this.admin
      .from("product_reviews")
      .select("rating")
      .gte("created_at", lastWeek.toISOString())
      .lt("created_at", thisWeek.toISOString())
      .eq("is_published", true as never);

    const thisRatings = ((thisWeekData ?? []) as Array<{ rating: number }>);
    const lastRatings = ((lastWeekData ?? []) as Array<{ rating: number }>);

    const thisAvg =
      thisRatings.length > 0
        ? thisRatings.reduce((s, r) => s + r.rating, 0) / thisRatings.length
        : null;
    const lastAvg =
      lastRatings.length > 0
        ? lastRatings.reduce((s, r) => s + r.rating, 0) / lastRatings.length
        : null;

    if (thisAvg == null && lastAvg == null) {
      return { findings, metrics: { skipped: "no_reviews" } };
    }

    findings.push(
      this.info(
        "review_trend",
        `Yorum ortalaması: ${thisAvg?.toFixed(2) ?? "—"} ⭐`,
        `Bu hafta: ${thisRatings.length} yorum, ort ${thisAvg?.toFixed(2) ?? "—"}\nGeçen hafta: ${lastRatings.length} yorum, ort ${lastAvg?.toFixed(2) ?? "—"}`,
        {
          thisWeek: { count: thisRatings.length, avg: thisAvg },
          lastWeek: { count: lastRatings.length, avg: lastAvg },
        }
      )
    );

    if (
      thisAvg != null &&
      lastAvg != null &&
      lastAvg - thisAvg >= TUNE.ratingDropThreshold &&
      thisRatings.length >= TUNE.minReviewsForTrend
    ) {
      findings.push(
        this.warning(
          "review_drop",
          `Yorum ortalaması ${(lastAvg - thisAvg).toFixed(2)} yıldız düştü`,
          `Bu hafta **${thisAvg.toFixed(2)}** ⭐, geçen hafta **${lastAvg.toFixed(2)}** ⭐. ${TUNE.ratingDropThreshold}+ yıldız düşüş şikayet sebebi olabilir. /admin/yorumlar incele.`,
          { dropAmount: lastAvg - thisAvg }
        )
      );
    }

    return {
      findings,
      metrics: { thisAvg, lastAvg, thisCount: thisRatings.length },
    };
  }

  // B) İptal/iade oranı
  private async checkCancellationRate() {
    const findings: AuditorFinding[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data } = await this.admin
      .from("orders")
      .select("status")
      .gte("created_at", since.toISOString());

    const rows = (data ?? []) as Array<{ status: string }>;
    if (rows.length === 0) return { findings, metrics: { rate: 0 } };

    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    const rate = cancelled / rows.length;

    if (rate >= TUNE.cancellationWarningRate) {
      findings.push(
        this.warning(
          "high_cancellation",
          `İptal oranı %${(rate * 100).toFixed(1)} (eşik %${TUNE.cancellationWarningRate * 100})`,
          `Son 30 günde **${cancelled} / ${rows.length}** sipariş iptal edildi. Yüksek oran müşteri memnuniyetsizliği belirtisi olabilir — neden incelenmeli.`,
          { cancelled, total: rows.length, rate }
        )
      );
    } else {
      findings.push(
        this.info(
          "cancellation_rate",
          `İptal oranı %${(rate * 100).toFixed(1)} (sağlıklı)`,
          `Son 30 gün: ${cancelled} iptal / ${rows.length} sipariş.`,
          { cancelled, total: rows.length, rate }
        )
      );
    }

    return { findings, metrics: { cancelled, total: rows.length, rate } };
  }

  // C) Tekrar müşteri oranı
  private async checkRepeatCustomerRate() {
    const findings: AuditorFinding[] = [];

    // RPC veya raw SQL gerekli (group by user_id having count > 1).
    // Basit yaklaşım: tüm user_id'ler + sayım.
    const { data } = await this.admin
      .from("orders")
      .select("user_id, status")
      .in("status", ["delivered", "shipped"] as never)
      .limit(1000);

    const rows = (data ?? []) as Array<{ user_id: string; status: string }>;

    const userOrderCount: Record<string, number> = {};
    for (const r of rows) {
      userOrderCount[r.user_id] = (userOrderCount[r.user_id] ?? 0) + 1;
    }

    const totalUsers = Object.keys(userOrderCount).length;
    const repeatUsers = Object.values(userOrderCount).filter(
      (c) => c >= 2
    ).length;
    const repeatRate = totalUsers > 0 ? repeatUsers / totalUsers : 0;

    findings.push(
      this.info(
        "repeat_rate",
        `Tekrar müşteri oranı: %${(repeatRate * 100).toFixed(1)}`,
        `${totalUsers} unique müşteri, ${repeatUsers}'i 2+ kez sipariş verdi (LTV göstergesi).`,
        { totalUsers, repeatUsers, repeatRate }
      )
    );

    return { findings, metrics: { totalUsers, repeatUsers, repeatRate } };
  }

  // D) Cart abandonment
  private async checkCartAbandonment() {
    const findings: AuditorFinding[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 7);

    // Son 7 günde cart_items var ama paid order yok
    const { data: cartData } = await this.admin
      .from("cart_items")
      .select("user_id, updated_at")
      .gte("updated_at", since.toISOString());

    const cartUsers = new Set(
      ((cartData ?? []) as Array<{ user_id: string | null }>)
        .map((r) => r.user_id)
        .filter((u): u is string => !!u)
    );

    if (cartUsers.size === 0) {
      return { findings, metrics: { abandonmentRate: 0, count: 0 } };
    }

    const userIds = Array.from(cartUsers);
    const { data: paidData } = await this.admin
      .from("orders")
      .select("user_id")
      .in("user_id", userIds)
      .gte("created_at", since.toISOString())
      .in("status", [
        "paid",
        "shipped",
        "delivered",
        "in_production",
      ] as never);

    const paidUsers = new Set(
      ((paidData ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
    );

    const abandonedUsers = userIds.filter((u) => !paidUsers.has(u));
    const rate = abandonedUsers.length / userIds.length;

    if (rate >= TUNE.abandonmentWarningRate) {
      findings.push(
        this.warning(
          "high_abandonment",
          `Sepet terkterme %${(rate * 100).toFixed(1)}`,
          `Son 7 günde **${abandonedUsers.length} / ${userIds.length}** kullanıcı sepet açtı ama satın almadı. Cart abandonment mail kampanyası faydalı olabilir (Sefa'nın gelecek dalga işi).`,
          { abandoned: abandonedUsers.length, total: userIds.length, rate }
        )
      );
    } else {
      findings.push(
        this.info(
          "abandonment_rate",
          `Cart abandonment %${(rate * 100).toFixed(1)}`,
          `${abandonedUsers.length} terk, ${userIds.length - abandonedUsers.length} dönüş.`,
          { abandoned: abandonedUsers.length, total: userIds.length, rate }
        )
      );
    }

    return {
      findings,
      metrics: {
        abandonmentRate: rate,
        abandonedCount: abandonedUsers.length,
        totalCartUsers: userIds.length,
      },
    };
  }

  // E) AOV — ortalama sipariş tutarı + trend
  private async checkAverageOrderValue() {
    const findings: AuditorFinding[] = [];

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 14);

    const successStatuses = [
      "paid",
      "shipped",
      "delivered",
      "in_production",
      "ready_to_ship",
      "qc_pending",
      "proof_pending",
    ];

    // Son 7 gün
    const { data: thisData } = await this.admin
      .from("orders")
      .select("total")
      .gte("created_at", thisWeek.toISOString())
      .in("status", successStatuses as never);

    // Önceki 7 gün
    const { data: lastData } = await this.admin
      .from("orders")
      .select("total")
      .gte("created_at", lastWeek.toISOString())
      .lt("created_at", thisWeek.toISOString())
      .in("status", successStatuses as never);

    const thisRows = (thisData ?? []) as Array<{ total: number | string }>;
    const lastRows = (lastData ?? []) as Array<{ total: number | string }>;

    if (thisRows.length === 0) {
      return {
        findings,
        metrics: { thisAvg: 0, lastAvg: 0, deviation: 0 },
      };
    }

    const thisAvg =
      thisRows.reduce((s, r) => s + Number(r.total ?? 0), 0) / thisRows.length;
    const lastAvg =
      lastRows.length > 0
        ? lastRows.reduce((s, r) => s + Number(r.total ?? 0), 0) /
          lastRows.length
        : thisAvg;
    const deviation = lastAvg > 0 ? (thisAvg - lastAvg) / lastAvg : 0;

    const fmtTl = (n: number) =>
      n.toLocaleString("tr-TR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }) + " ₺";

    if (deviation < -0.2) {
      findings.push(
        this.warning(
          "aov_drop",
          `AOV %${Math.abs(deviation * 100).toFixed(0)} düştü: ${fmtTl(thisAvg)}`,
          `Bu hafta ortalama sipariş tutarı **${fmtTl(thisAvg)}** (önceki hafta ${fmtTl(lastAvg)}). Düşüş anormal — küçük sipariş ağırlığı artmış olabilir. Cross-sell + bundle teklif denenebilir.`,
          { thisAvg, lastAvg, deviation, thisCount: thisRows.length }
        )
      );
    } else if (deviation > 0.2) {
      findings.push(
        this.info(
          "aov_grow",
          `AOV %${(deviation * 100).toFixed(0)} büyüdü: ${fmtTl(thisAvg)}`,
          `Bu hafta ortalama sipariş tutarı **${fmtTl(thisAvg)}** (önceki hafta ${fmtTl(lastAvg)}). Büyüme pozitif sinyal.`,
          { thisAvg, lastAvg, deviation }
        )
      );
    } else {
      findings.push(
        this.info(
          "aov_stable",
          `AOV: ${fmtTl(thisAvg)} (stabil)`,
          `Bu hafta: ${fmtTl(thisAvg)} (${thisRows.length} sipariş) · Önceki: ${fmtTl(lastAvg)}.`,
          { thisAvg, lastAvg, deviation, thisCount: thisRows.length }
        )
      );
    }

    return {
      findings,
      metrics: {
        thisAvg,
        lastAvg,
        deviation,
        thisCount: thisRows.length,
        lastCount: lastRows.length,
      },
    };
  }

  // F) Segment mix — B2B vs bireysel sipariş oranı
  private async checkSegmentMix() {
    const findings: AuditorFinding[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // orders.invoice jsonb içinde invoice_type ya da fatura kayıt yapısı
    // Basit yaklaşım: orders'i çek, JSON içinden invoice_type kontrol
    const { data } = await this.admin
      .from("orders")
      .select("invoice, total")
      .gte("created_at", since.toISOString())
      .in("status", [
        "paid",
        "shipped",
        "delivered",
        "in_production",
        "ready_to_ship",
      ] as never)
      .limit(500);

    const rows = (data ?? []) as Array<{
      invoice: { type?: string; vkn?: string; company_name?: string } | null;
      total: number | string;
    }>;

    if (rows.length === 0) {
      return { findings, metrics: { total: 0 } };
    }

    let b2bCount = 0;
    let bireyselCount = 0;
    let b2bRevenue = 0;
    let bireyselRevenue = 0;

    for (const r of rows) {
      const isB2B = !!(r.invoice?.vkn || r.invoice?.company_name);
      const total = Number(r.total ?? 0);
      if (isB2B) {
        b2bCount++;
        b2bRevenue += total;
      } else {
        bireyselCount++;
        bireyselRevenue += total;
      }
    }

    const totalRevenue = b2bRevenue + bireyselRevenue;
    const b2bShare = totalRevenue > 0 ? b2bRevenue / totalRevenue : 0;

    const fmtTl = (n: number) =>
      n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";

    findings.push(
      this.info(
        "segment_mix",
        `B2B %${(b2bShare * 100).toFixed(0)} · Bireysel %${((1 - b2bShare) * 100).toFixed(0)}`,
        `Son 30 gün ciro dağılımı:\n- **B2B:** ${b2bCount} sipariş · ${fmtTl(b2bRevenue)}\n- **Bireysel:** ${bireyselCount} sipariş · ${fmtTl(bireyselRevenue)}\n\nToplam: ${rows.length} sipariş · ${fmtTl(totalRevenue)}`,
        {
          b2b: { count: b2bCount, revenue: b2bRevenue },
          bireysel: { count: bireyselCount, revenue: bireyselRevenue },
          b2bShare,
        }
      )
    );

    return {
      findings,
      metrics: {
        b2bCount,
        bireyselCount,
        b2bRevenue,
        bireyselRevenue,
        b2bShare,
      },
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
  const reviews = metrics.reviews as { thisAvg?: number; thisCount?: number } | undefined;
  const cancel = metrics.cancellation as { rate?: number } | undefined;
  const repeat = metrics.repeat as { repeatRate?: number } | undefined;

  const lines: string[] = [
    `# 😊 Müşteri Memnuniyeti Raporu`,
    "",
    `- **Yorum:** ${reviews?.thisAvg?.toFixed(2) ?? "—"} ⭐ (${reviews?.thisCount ?? 0} bu hafta)`,
    `- **İptal oranı (30g):** %${((cancel?.rate ?? 0) * 100).toFixed(1)}`,
    `- **Tekrar müşteri:** %${((repeat?.repeatRate ?? 0) * 100).toFixed(1)}`,
    `- **Bulgu:** ${counts.total} (${counts.warning} uyarı · ${counts.info} bilgi)`,
    "",
  ];

  findings.forEach((f) => {
    const icon = f.severity === "warning" ? "🟡" : "ℹ️";
    lines.push(`${icon} **${f.title}**`);
    if (f.severity !== "info") lines.push(f.description);
    lines.push("");
  });

  return lines.join("\n");
}
