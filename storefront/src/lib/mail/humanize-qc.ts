/**
 * Design QC çıktısını müşteri-diline çevirir (Pim AI + fallback).
 */

import "server-only";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { OPENAI_MINI_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";

const WarningsSchema = z.object({
  warnings: z.array(z.string().max(200)).max(3),
});

const ReasonSchema = z.object({
  reason: z.string().max(400),
});

const SYSTEM_PROMPT = `
Sen Pim Etiket müşteri bildirim asistanısın. Tasarım QC teknik bulgularını
müşteriye gidecek kısa, net Türkçe metne çevirirsin.

KURALLAR (Sefa — zorunlu):
- "sen" kullan, "siz" KULLANMA
- Dalkavuk YOK ("harika", "mükemmel" yasak)
- Yapay empati YOK
- Teknik jargonu sadeleştir; abartma veya uydurma YOK
- Max 1-3 madde / 2-3 cümle
`.trim();

const QC_ISSUE_FALLBACK =
  "Dosyanda baskı kalitesini etkileyebilecek bir nokta var; birlikte bakalım.";

const QC_REASON_FALLBACK =
  "Dosyan mevcut hâliyle baskıya uygun değil; düzeltmek için bize ulaş.";

export async function humanizeQcWarnings(
  rawWarnings: string[]
): Promise<string[]> {
  const cleaned = rawWarnings.map((w) => w.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return [QC_ISSUE_FALLBACK];
  }

  if (!process.env.OPENAI_API_KEY || (await isGlobalAiBudgetExceeded())) {
    return cleaned.slice(0, 3);
  }

  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: WarningsSchema,
      system: SYSTEM_PROMPT,
      prompt: `QC uyarıları (müşteri diline çevir, max 3 madde):\n${cleaned.join("\n")}`,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });
    await logAiUsage({
      source: "humanize_qc",
      model: "gpt-4o-mini",
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    });
    const warnings = result.object.warnings
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 3);
    return warnings.length > 0 ? warnings : cleaned.slice(0, 3);
  } catch (err) {
    console.warn("[mail/humanize-qc] warnings AI fallback:", err);
    return cleaned.slice(0, 3);
  }
}

export async function humanizeQcReason(args: {
  reason: string;
  issueCategory?: string;
}): Promise<string> {
  const note = args.reason.trim();
  if (!note) {
    return QC_REASON_FALLBACK;
  }

  if (!process.env.OPENAI_API_KEY || (await isGlobalAiBudgetExceeded())) {
    return note;
  }

  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: ReasonSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        args.issueCategory ? `Kategori: ${args.issueCategory}` : "",
        `QC red gerekçesi (müşteri diline çevir):\n${note}`,
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });
    await logAiUsage({
      source: "humanize_qc",
      model: "gpt-4o-mini",
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    });
    const reason = result.object.reason.trim();
    return reason.length > 0 ? reason : note;
  } catch (err) {
    console.warn("[mail/humanize-qc] reason AI fallback:", err);
    return note;
  }
}
