import "server-only";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { OPENAI_MINI_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";
import {
  fallbackSearchIntent,
  resolveSearchIntentAction,
} from "./intent-routing";
import type {
  ParsedSearchIntent,
  SearchIntentAction,
} from "./search-intent-types";

export const MAX_SEARCH_QUERY_CHARS = 200;

const SearchIntentSchema = z.object({
  intent: z.enum(["configure", "browse", "info", "unclear"]),
  productType: z.enum(["sticker", "etiket", "none"]),
  material: z.enum(["vinil", "transparan", "holo", "simli"]).optional(),
  finish: z.enum(["parlak", "mat", "yok"]).optional(),
  shape: z
    .enum(["die", "square", "circle", "oval", "rectangle", "ozel"])
    .optional(),
  sizeHint: z.string().max(80).optional(),
  qty: z.number().min(25).max(1000).optional(),
  confidence: z.number().min(0).max(1),
  clarifyQuestion: z.string().max(200).optional(),
});

const SYSTEM_PROMPT = `
Sen Pim Etiket arama niyet çözümleyicisisin. Müşteri doğal dilde yazar — sen YÖNLENDİRME önerisi üretirsin (sohbet değil).

ÜRÜNLER:
- sticker: 25+ adet, vinil/transparan/holo/simli, şekiller (kare/yuvarlak/kontur)
- etiket: rulo/tabaka (şu an sitede bilgi sayfası var)

INTENT:
- configure: net ürün + parametre (malzeme/şekil/adet) → konfigüratöre git
- browse: ürün keşfi, genel sticker/etiket araması
- info: teslimat, dosya, SSS, fiyat bilgisi (rakam VERME)
- unclear: emin değilsen — tahmin ETME, clarifyQuestion ile TEK soru sor

KURALLAR (Sefa):
- Dalkavuk/empati YOK ("Anlıyorum", "harika fikir" yasak)
- "süresiz", "Bursa" bahsetme
- Emin değilsen intent=unclear + clarifyQuestion
- confidence düşükse (<0.6) unclear tercih et
- Malzeme: vinil (varsayılan), transparan/şeffaf→transparan, holografik→holo, simli→simli
- Şekil: yuvarlak/daire→circle, kare→square, kontur/özel→die veya ozel
- Yüzey: parlak/mat/kaplamasız→yok
- Adet: 25-1000 arası sayı varsa qty'ye yaz
`.trim();

export interface SearchIntentResponse {
  intent: ParsedSearchIntent;
  action: SearchIntentAction;
  fallback: boolean;
}

export async function parseSearchIntent(
  rawQuery: string
): Promise<SearchIntentResponse> {
  const query = rawQuery.trim().slice(0, MAX_SEARCH_QUERY_CHARS);
  if (query.length < 2) {
    const intent = fallbackSearchIntent(query);
    return {
      intent,
      action: resolveSearchIntentAction(intent),
      fallback: true,
    };
  }

  if (!process.env.OPENAI_API_KEY || (await isGlobalAiBudgetExceeded())) {
    const intent = fallbackSearchIntent(query);
    return {
      intent,
      action: resolveSearchIntentAction(intent),
      fallback: true,
    };
  }

  const startedAt = Date.now();
  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: SearchIntentSchema,
      system: SYSTEM_PROMPT,
      prompt: `Sorgu: ${query}`,
      temperature: 0.2,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });

    const intent: ParsedSearchIntent = {
      intent: result.object.intent,
      productType: result.object.productType,
      material: result.object.material,
      finish: result.object.finish,
      shape: result.object.shape,
      sizeHint: result.object.sizeHint,
      qty: result.object.qty,
      confidence: result.object.confidence,
      clarifyQuestion: result.object.clarifyQuestion,
    };

    if (intent.confidence < 0.55 && intent.intent !== "unclear") {
      intent.intent = "unclear";
      intent.clarifyQuestion ??=
        "Sticker mı etiket mi arıyorsun? Boyut veya adet varsa yaz.";
    }

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    if (inputTokens + outputTokens > 0) {
      await logAiUsage({
        source: "search_intent",
        model: "gpt-4o-mini",
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
      });
    }

    return {
      intent,
      action: resolveSearchIntentAction(intent),
      fallback: false,
    };
  } catch (err) {
    console.error("[parse-search-intent] failed:", err);
    const intent = fallbackSearchIntent(query);
    return {
      intent,
      action: resolveSearchIntentAction(intent),
      fallback: true,
    };
  }
}
