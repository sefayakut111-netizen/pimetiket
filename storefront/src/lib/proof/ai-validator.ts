import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";

const ProofValidationSchema = z.object({
  overall_verdict: z.enum(["pass", "warn", "fail"]),
  cutline: z.object({
    verdict: z.enum(["pass", "warn", "fail"]),
    edge_tracking: z.enum([
      "accurate",
      "minor_deviation",
      "major_deviation",
    ]),
    offset_adequate: z.boolean(),
    sharp_corners: z.boolean(),
    noise_contours: z.boolean(),
    complexity: z.enum(["simple", "moderate", "complex", "too_complex"]),
    issues_tr: z.array(z.string()),
  }),
  white_layer: z.object({
    verdict: z.enum(["pass", "warn", "fail", "not_applicable"]),
    within_bounds: z.boolean(),
    overflow: z.boolean(),
    missing_details: z.boolean(),
    edge_quality: z.enum(["clean", "rough", "jagged", "not_applicable"]),
    issues_tr: z.array(z.string()),
  }),
  auto_fix_suggestions: z.array(
    z.object({
      area: z.enum(["cutline", "white_layer"]),
      action: z.string(),
      description_tr: z.string(),
    })
  ),
  pim_message: z.string(),
});

export type ProofAIResult = z.infer<typeof ProofValidationSchema>;

const SYSTEM_PROMPT = `Sen bir matbaa baskı üretim kalite kontrol uzmanısın.
Sana 3 görsel veriliyor:
1. Orijinal müşteri tasarımı
2. Üretilen bıçak (kesim) çizgisi — kırmızı overlay
3. Beyaz katman — mavi overlay (yoksa "beyaz katman yok" denilecek)

BIÇAK KONTROLLERİ:
- Bıçak çizgisi tasarımın dış kenarını doğru takip ediyor mu?
- Offset (taşma payı) yeterli mi? (minimum 1-2mm)
- 90° altı keskin köşeler var mı? (die-cut makinesi için sorun)
- Gürültü konturları var mı? (tasarımla ilgisiz küçük parçalar)
- Karmaşıklık: kontur çok mu detaylı?

BEYAZ KATMAN KONTROLLERİ (varsa):
- Beyaz alan tasarım sınırları içinde mi?
- Dışa taşma var mı?
- İnce yazı/çizgilerde beyaz eksik mi?
- Kenarlar temiz mi yoksa pürüzlü mü?

Pim mesajı Türkçe, samimi, kısa (2 cümle max). "Sen" hitap. Dalkavukluk yasak.`;

export async function validateProofWithAI(
  designImageUrl: string,
  cutlineOverlayUrl: string,
  whiteLayerOverlayUrl: string | null
): Promise<ProofAIResult> {
  if (await isGlobalAiBudgetExceeded()) {
    throw new Error("ai_budget_exceeded");
  }

  const images: Array<
    { type: "image"; image: URL } | { type: "text"; text: string }
  > = [
    { type: "image", image: new URL(designImageUrl) },
    { type: "image", image: new URL(cutlineOverlayUrl) },
  ];

  if (whiteLayerOverlayUrl) {
    images.push({ type: "image", image: new URL(whiteLayerOverlayUrl) });
  }

  const result = await generateObject({
    model: openai("gpt-4o"),
    schema: ProofValidationSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...images,
          {
            type: "text",
            text: whiteLayerOverlayUrl
              ? "3 görseli karşılaştır: orijinal tasarım, bıçak çizgisi (kırmızı), beyaz katman (mavi)."
              : "2 görseli karşılaştır: orijinal tasarım ve bıçak çizgisi (kırmızı). Beyaz katman yok.",
          },
        ],
      },
    ],
    temperature: 0.3,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(45_000),
  });

  await logAiUsage({
    source: "proof_validate",
    model: "gpt-4o",
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
  });

  return result.object;
}
