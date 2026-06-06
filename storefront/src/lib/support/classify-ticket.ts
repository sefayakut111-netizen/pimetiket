/**
 * Destek talebi AI sınıflandırma — kategori + öncelik + taslak yanıt ÖNERİSİ.
 * Gerçek category/admin_response alanlarına YAZMAZ; operatör onayı şart.
 */

import "server-only";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPENAI_MINI_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";

const ClassificationSchema = z.object({
  category: z.enum([
    "genel",
    "siparis",
    "tasarim",
    "kargo",
    "iade",
    "teknik",
    "fiyat",
  ]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  draft_response: z.string().max(500),
});

const SYSTEM_PROMPT = `
Sen Pim Etiket destek ekibinin sınıflandırma asistanısın. Gelen destek talebini analiz edip YAPILANDIRILMIŞ öneri üretirsin.

KATEGORİLER:
- genel: genel soru, site, hesap
- siparis: sipariş durumu, ödeme, dosya yükleme
- tasarim: dosya formatı, DPI, CMYK, bleed, tasarım hazırlığı
- kargo: teslimat, takip, gecikme
- iade: iade, değişim, şikayet
- teknik: site hatası, giriş, teknik sorun
- fiyat: fiyat sorgusu, teklif (maliyet/karlılık detayı VERME)

ÖNCELİK:
- urgent: acil üretim/kargo, ödeme blokesi, sipariş iptal riski
- high: geciken sipariş, prova onayı bekleyen kritik
- normal: standart soru
- low: bilgi, genel merak

TASLAK YANIT KURALLARI (Sefa — Pim BRAND_VOICE):
- Türkçe, kısa (max 3-4 cümle), net ve çözüm odaklı
- "sen" kullan, "siz" KULLANMA
- Dalkavuk YOK: "harika fikir", "mükemmel seçim" yasak
- Yapay empati YOK: "Anlıyorum, çok değerli" yasak
- "Üzgünüm/Maalesef" ile başlama — önce çözüm
- "süresiz indirim", "Bursa" bahsetme
- Otomatik gönderim yok — bu bir TASLAK öneri, operatör düzenleyecek
- Kesin tarih vaadi verme; "ortalama X iş günü" kullan
`.trim();

export async function classifyTicket(ticketId: string): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;
  if (await isGlobalAiBudgetExceeded()) return;

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, subject, message, ai_classified_at")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket || ticket.ai_classified_at) return;

  const subject = String(ticket.subject ?? "").slice(0, 200);
  const message = String(ticket.message ?? "").slice(0, 4000);
  if (!subject || !message) return;

  const startedAt = Date.now();
  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: ClassificationSchema,
      system: SYSTEM_PROMPT,
      prompt: `Konu: ${subject}\n\nMesaj:\n${message}`,
      temperature: 0.3,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });

    const { category, priority, draft_response } = result.object;

    await admin
      .from("support_tickets")
      .update({
        ai_category_suggestion: category,
        ai_priority_suggestion: priority,
        ai_draft_response: draft_response.trim().slice(0, 500),
        ai_classified_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    if (inputTokens + outputTokens > 0) {
      await logAiUsage({
        source: "support_classify",
        model: "gpt-4o-mini",
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
    }
  } catch (err) {
    console.error("[classify-ticket] failed:", ticketId, err);
  }
}
