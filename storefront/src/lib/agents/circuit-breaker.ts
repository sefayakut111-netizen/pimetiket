/**
 * AI Circuit Breaker — Pim Etiket P1 #8
 *
 * Sefa 20 May v68 (8-agent denetim P1 #8):
 * OpenAI gpt-4o downtime senaryosu — Vision API timeout/500 dönerse
 * runOrderDesignQC her sipariş için 30 saniye bekleyip throw eder,
 * sipariş paid'de takılır, müşteri "ödedim hiçbir şey olmuyor" diye
 * ulaşır.
 *
 * Fix: son N dakika içindeki design_quality_checks satırlarına bak,
 * verdict='error' oranı eşiği geçerse circuit "open" → AI'a hiç gitme,
 * direkt insan kuyruğuna at (status='human_review').
 *
 * Ekstra tablo yok — mevcut design_quality_checks audit log'undan
 * okuruz. Window'lar hardcoded; ileride env var yapılabilir.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Son kaç dakikalık pencere izlenir */
export const AI_CIRCUIT_WINDOW_MIN = 10;
/** Pencerede en az kaç sample olmalı (az veride yanlış pozitif olmasın) */
export const AI_CIRCUIT_MIN_SAMPLES = 5;
/** Hata oranı eşiği — bu üzeri circuit OPEN */
export const AI_CIRCUIT_FAIL_RATIO = 0.5;

export interface CircuitStatus {
  open: boolean;
  totalRuns: number;
  errorRuns: number;
  failureRate: number; // 0..1
  windowMin: number;
}

/**
 * AI circuit "open" mı? — son 10dk içindeki design_quality_checks
 * verdict dağılımına bakar. Min sample sayısı altındaysa kapalı varsayar.
 */
export async function isAiCircuitOpen(
  admin: SupabaseClient
): Promise<CircuitStatus> {
  const sinceIso = new Date(
    Date.now() - AI_CIRCUIT_WINDOW_MIN * 60_000
  ).toISOString();

  const { data, error } = await admin
    .from("design_quality_checks")
    .select("verdict")
    .gte("created_at", sinceIso);

  if (error) {
    // DB sorgusu patlarsa fail-safe: circuit kapalı say (mevcut akış devam etsin)
    return {
      open: false,
      totalRuns: 0,
      errorRuns: 0,
      failureRate: 0,
      windowMin: AI_CIRCUIT_WINDOW_MIN,
    };
  }

  const rows = (data ?? []) as Array<{ verdict: string }>;
  const totalRuns = rows.length;
  const errorRuns = rows.filter((r) => r.verdict === "error").length;
  const failureRate = totalRuns > 0 ? errorRuns / totalRuns : 0;

  // Az veri = circuit kapalı (yanlış pozitif önle)
  const open =
    totalRuns >= AI_CIRCUIT_MIN_SAMPLES &&
    failureRate >= AI_CIRCUIT_FAIL_RATIO;

  return {
    open,
    totalRuns,
    errorRuns,
    failureRate,
    windowMin: AI_CIRCUIT_WINDOW_MIN,
  };
}
