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

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isResendConfigured, sendMail } from "@/lib/mail/resend";
import { getSiteUrl } from "@/lib/site-url";

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
    // DB sorgusu patlarsa fail-closed: AI'a gitme, insan kuyruğuna yönlendir.
    // (Fail-open eski davranış OpenAI kesintisinde gereksiz yük + paid'de takılma riski.)
    console.error("[circuit-breaker] design_quality_checks query failed:", error);
    return {
      open: true,
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

const CIRCUIT_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Circuit OPEN → Sentry + (opsiyonel) admin mail. Saatte en fazla 1 kez.
 * İlk `ai_circuit_open_fallback` event'i öncesi çağrılır.
 */
export async function notifyAiCircuitOpenIfNeeded(
  admin: SupabaseClient,
  orderId: string,
  circuit: CircuitStatus
): Promise<void> {
  const sinceIso = new Date(Date.now() - CIRCUIT_ALERT_COOLDOWN_MS).toISOString();
  const { count } = await admin
    .from("order_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "ai_circuit_open_fallback")
    .gte("created_at", sinceIso);

  if ((count ?? 0) > 0) return;

  Sentry.captureMessage("AI QC circuit breaker OPEN", {
    level: "error",
    extra: {
      failureRate: circuit.failureRate,
      window: circuit.windowMin,
      errorRuns: circuit.errorRuns,
      totalRuns: circuit.totalRuns,
      orderId,
    },
  });

  const recipients = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

  if (recipients.length === 0 || !isResendConfigured()) return;

  const site = getSiteUrl();
  const pct = Math.round(circuit.failureRate * 100);
  await sendMail({
    to: recipients,
    subject: `[Pim Etiket] AI QC circuit breaker OPEN (%${pct} hata)`,
    html: `
      <h2>AI QC circuit breaker açıldı</h2>
      <p>Son <strong>${circuit.windowMin} dk</strong> içinde hata oranı <strong>%${pct}</strong> (${circuit.errorRuns}/${circuit.totalRuns}).</p>
      <p>Yeni siparişler proof_generating fallback'e yönlendiriliyor.</p>
      <p>Tetikleyen sipariş: <code>${orderId}</code></p>
      <p><a href="${site}/admin/siparisler">Sipariş paneli</a></p>
    `,
    text: `AI QC circuit OPEN — %${pct} hata (${circuit.errorRuns}/${circuit.totalRuns}). Sipariş: ${orderId}`,
  });
}
