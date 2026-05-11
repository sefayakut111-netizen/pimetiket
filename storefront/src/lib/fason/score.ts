/**
 * Fason performans skorlama — SAF FONKSİYON.
 *
 * DB tarafında `fn_refresh_fason_scores()` ile birebir uyumlu olmalı.
 * Test edilebilirlik için ayrı TS implementation tutuyoruz.
 *
 * Ağırlıklar (toplam = 1.0):
 *   - on_time_rate × 0.40
 *   - (1 - return_rate) × 0.30
 *   - response_score × 0.15
 *   - (1 - issue_rate) × 0.15
 */

export interface FasonPerformanceMetrics {
  /** Tamamlanan (shipped) atamaların oranı (0-1). null = veri yok */
  onTimeRate: number | null;
  /** İade oranı (0-1). null = veri yok */
  returnRate: number | null;
  /** sent → in_production ortalama saat. null = veri yok */
  avgResponseHours: number | null;
  /** İssue oranı (0-1). null = veri yok */
  issueRate: number | null;
}

export interface FasonScoreResult {
  /** 0.00-1.00 arası kompozit skor */
  score: number;
  /** Skor etiketleri */
  tier: "premium" | "normal" | "warning";
  /** Etiketin Türkçe açıklaması */
  tierLabel: string;
  /** Skor bileşenleri (debug + UI için) */
  breakdown: {
    onTimeScore: number;
    qualityScore: number;
    responseScore: number;
    issueScore: number;
  };
}

const DEFAULT_NEW_FASON_ON_TIME = 0.7;
const DEFAULT_NEW_FASON_RESPONSE = 0.7;
const RESPONSE_FAST_THRESHOLD_HOURS = 24;
const RESPONSE_SLOW_THRESHOLD_HOURS = 48;

/**
 * sent → in_production süresinden response_score üret.
 * <=24 saat = 1.0, >=48 saat = 0.0, arası lineer.
 */
export function calculateResponseScore(avgResponseHours: number | null): number {
  if (avgResponseHours === null) return DEFAULT_NEW_FASON_RESPONSE;
  if (avgResponseHours <= RESPONSE_FAST_THRESHOLD_HOURS) return 1.0;
  if (avgResponseHours >= RESPONSE_SLOW_THRESHOLD_HOURS) return 0.0;
  return (
    (RESPONSE_SLOW_THRESHOLD_HOURS - avgResponseHours) /
    (RESPONSE_SLOW_THRESHOLD_HOURS - RESPONSE_FAST_THRESHOLD_HOURS)
  );
}

/**
 * Composite skor hesabı — Migration 021 fn_refresh_fason_scores ile birebir.
 */
export function calculateFasonScore(
  metrics: FasonPerformanceMetrics
): FasonScoreResult {
  const onTime = metrics.onTimeRate ?? DEFAULT_NEW_FASON_ON_TIME;
  const returnRate = metrics.returnRate ?? 0;
  const responseScore = calculateResponseScore(metrics.avgResponseHours);
  const issueRate = metrics.issueRate ?? 0;

  const onTimeScore = onTime * 0.4;
  const qualityScore = (1 - returnRate) * 0.3;
  const responseWeighted = responseScore * 0.15;
  const issueScore = (1 - issueRate) * 0.15;

  const score = Math.max(
    0,
    Math.min(1, onTimeScore + qualityScore + responseWeighted + issueScore)
  );

  let tier: FasonScoreResult["tier"] = "warning";
  let tierLabel = "Düşük performans — dikkat";
  if (score >= 0.9) {
    tier = "premium";
    tierLabel = "Yüksek performans · ⭐ öncelikli";
  } else if (score >= 0.7) {
    tier = "normal";
    tierLabel = "Normal performans";
  }

  return {
    score: Math.round(score * 100) / 100,
    tier,
    tierLabel,
    breakdown: {
      onTimeScore: Math.round(onTimeScore * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
      responseScore: Math.round(responseWeighted * 100) / 100,
      issueScore: Math.round(issueScore * 100) / 100,
    },
  };
}

/**
 * Skor tier'a göre Tailwind renk class'ları (UI için).
 */
export function tierToColors(tier: FasonScoreResult["tier"]): {
  text: string;
  bg: string;
  ring: string;
} {
  switch (tier) {
    case "premium":
      return { text: "text-yesil", bg: "bg-yesil-soft", ring: "ring-yesil/30" };
    case "normal":
      return {
        text: "text-pim-mercan",
        bg: "bg-pim-mercan-tint",
        ring: "ring-pim-mercan/20",
      };
    case "warning":
      return {
        text: "text-kirmizi",
        bg: "bg-kirmizi/10",
        ring: "ring-kirmizi/20",
      };
  }
}
