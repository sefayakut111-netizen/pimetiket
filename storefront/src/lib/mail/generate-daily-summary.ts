/**
 * Admin günlük özet — ham sayılardan fallback + opsiyonel AI brifing.
 */

import "server-only";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { OPENAI_MINI_TIMEOUT_MS } from "@/lib/http/external-timeouts";

export interface DailySummaryStats {
  newOrders24h: number;
  revenue24h: number;
  awaitingUpload: number;
  awaitingUploadStale: number;
  aiQcQueue: number;
  proofPending: number;
  inProduction: number;
  shipped24h: number;
  partnerCapacityWarn: number;
  fasonOverdueCount: number;
}

const SummarySchema = z.object({
  summary: z.string().max(800),
});

const SYSTEM_PROMPT = `
Sen Pim Etiket operasyon asistanısın. Son 24 saatin rakamlarını Sefa'ya
sabah brifingi olarak 4-6 cümlede özetlersin.

KURALLAR:
- Türkçe, net, operasyonel
- Dalkavuk/emoji yok
- Yalnız verilen sayıları kullan; uydurma yok
- Kritik uyarı varsa (stale upload, partner kapasite) öne çıkar
`.trim();

export function buildDailySummaryFallback(stats: DailySummaryStats): string {
  const revenue = Math.round(stats.revenue24h).toLocaleString("tr-TR");
  const lines = [
    `Yeni sipariş: ${stats.newOrders24h}`,
    `Ciro (24sa): ${revenue} ₺`,
    `Kargolanan (24sa): ${stats.shipped24h}`,
    "",
    "Kuyruklar:",
    `- Tasarım bekleyen: ${stats.awaitingUpload}${stats.awaitingUploadStale > 0 ? ` (${stats.awaitingUploadStale} stale)` : ""}`,
    `- AI QC: ${stats.aiQcQueue}`,
    `- Prova onayı: ${stats.proofPending}`,
    `- Üretimde: ${stats.inProduction}`,
  ];
  if (stats.partnerCapacityWarn > 0) {
    lines.push(`⚠ Partner kapasite: ${stats.partnerCapacityWarn} partner %85+ dolu`);
  }
  if (stats.fasonOverdueCount > 0) {
    lines.push(`⚠ Gecikmiş fason işi: ${stats.fasonOverdueCount}`);
  }
  return lines.join("\n");
}

export async function generateDailySummaryAi(
  stats: DailySummaryStats
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const fallback = buildDailySummaryFallback(stats);

  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: SummarySchema,
      system: SYSTEM_PROMPT,
      prompt: `Ham veriler:\n${fallback}`,
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });
    const summary = result.object.summary.trim();
    return summary.length > 0 ? summary : null;
  } catch (err) {
    console.warn("[mail/generate-daily-summary] AI fallback:", err);
    return null;
  }
}
