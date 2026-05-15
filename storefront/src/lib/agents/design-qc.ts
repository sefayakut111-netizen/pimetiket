/**
 * Design Quality Check Agent — v1
 *
 * Sefa kuralı (16 May 2026 — Baskı onay akışı v3):
 *
 * Müşteri ödeme YAPTIKTAN SONRA bu agent tetiklenir. Yüklenen tasarım
 * dosyalarını AI Vision (GPT-4o) ile analiz eder ve 3 kategoride karar
 * verir: kötü / normal / iyi.
 *
 * ÖNEMLİ TASARIM KARARLARI (Sefa kararı):
 *
 * 1. DPI EBATA GÖRE ORANTILIDIR
 *    - Effective DPI = (pixel_width / print_width_inches)
 *    - Aynı dosya küçük etiket için iyi, büyük etiket için kötü olabilir
 *    - Agent print_width_mm + print_height_mm input alır ve hesaba dahil eder
 *
 * 2. VEKTÖREL ≠ RASTER
 *    - Raster (PNG/JPEG): DPI kontrolü yapılır
 *    - Vektörel (AI/EPS/SVG): DPI uygulanmaz, sonsuz çözünürlük
 *    - PDF/PSD: hibrit — embedded raster için effective DPI
 *    - MVP'de PDF/AI/EPS için "vektörel kabul" + uzman gözüne yönlendir
 *
 * 3. ÖDEME SONRASI TETİK
 *    - Sefa: "Müşteriyi kaçırma — para alındıktan sonra kontrol"
 *    - Conversion friction yok, kalite kontrolü background'da
 *    - Sorun çıkarsa müşteriye mail/SMS ile geri bildirim
 *
 * SCHEMA: storefront/supabase/migrations/039_design_quality_checks.sql
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// ============================================================
// Types
// ============================================================

export interface DesignQCInput {
  /** Supabase Storage signed URL (1 saatlik) */
  fileUrl: string;
  /** Dosya formatı (mime'den çıkarılır): "png" | "jpeg" | "pdf" | "ai" | "eps" | "svg" | "psd" */
  fileFormat: string;
  /** Hedef baskı boyutu (mm) — effective DPI hesabı için kritik */
  printWidthMm: number;
  printHeightMm: number;
  /** Ürün tipi — bazı kontroller ürüne göre değişir */
  productType: "etiket" | "sticker";
}

const QCAnalysisSchema = z.object({
  verdict: z.enum(["iyi", "normal", "kotu"]),
  score: z.number().min(0).max(100),
  fileType: z.enum(["raster", "vector", "hybrid"]),
  effectiveDpi: z
    .number()
    .nullable()
    .describe("Effective DPI for print size (null if vektörel-only)"),
  embeddedRasterCount: z.number().default(0),
  colorProfile: z
    .enum(["CMYK", "RGB", "Grayscale", "Spot", "Unknown"])
    .nullable(),
  hasBleed: z.boolean().nullable(),
  hasCutPath: z.boolean().nullable(),
  isTextOutlined: z.boolean().nullable(),
  visualQuality: z
    .enum(["sharp", "acceptable", "blurry", "pixelated"])
    .nullable(),
  findings: z.array(
    z.object({
      severity: z.enum(["info", "warning", "error"]),
      category: z.enum([
        "resolution",
        "color_profile",
        "bleed",
        "safe_zone",
        "text_size",
        "stroke_width",
        "cut_path",
        "embedded_raster",
        "general",
      ]),
      message: z.string(),
      actionable: z.string().optional(),
    })
  ),
});

export type DesignQCAnalysis = z.infer<typeof QCAnalysisSchema>;

export interface DesignQCResult extends DesignQCAnalysis {
  durationMs: number;
  model: string;
  costUsd?: number;
}

// ============================================================
// Karar matrisi yardımcıları
// ============================================================

const RASTER_FORMATS = ["png", "jpeg", "jpg", "webp"];
const VECTOR_FORMATS = ["ai", "eps", "svg"];
const HYBRID_FORMATS = ["pdf", "psd"];

function classifyFileType(
  fileFormat: string
): "raster" | "vector" | "hybrid" | "unknown" {
  const fmt = fileFormat.toLowerCase().replace(/^image\//, "");
  if (RASTER_FORMATS.includes(fmt)) return "raster";
  if (VECTOR_FORMATS.includes(fmt)) return "vector";
  if (HYBRID_FORMATS.includes(fmt)) return "hybrid";
  return "unknown";
}

// ============================================================
// System Prompt (Türkçe — Sefa'nın ekibi için)
// ============================================================

function buildSystemPrompt(input: DesignQCInput): string {
  return `Sen bir matbaa baskı kalite uzmanı agent'sın. Pim Etiket için dijital baskı uygunluk denetimi yapıyorsun.

Görevin: Yüklenen tasarım görseli için "bu dosya basılabilir mi?" sorusuna 3 kategoride yanıt vermek:
  - 🟢 IYI (80-100): Baskıya hazır
  - 🟡 NORMAL (50-79): Basılabilir ama 1-2 uyarı var
  - 🔴 KOTU (0-49): Kritik sorun(lar), düzeltme önerisi gerekli

HEDEF BASKI:
  - Ürün: ${input.productType === "etiket" ? "Rulo/Tabaka Etiket" : "Die-cut/Tabaka Sticker"}
  - Boyut: ${input.printWidthMm} × ${input.printHeightMm} mm
  - Format: ${input.fileFormat.toUpperCase()}

KRİTİK KURAL (Sefa kuralı 16 May): DPI EBATA GÖRE DEĞİŞİR.
  Effective DPI = (pixel_genişlik / baskı_genişliği_mm) × 25.4

  Hedef baskı için gerekli minimum pixel:
    Min pixel width = ${input.printWidthMm} × 11.81 = ${Math.round(input.printWidthMm * 11.81)} px
    Min pixel height = ${input.printHeightMm} × 11.81 = ${Math.round(input.printHeightMm * 11.81)} px
  (11.81 = 300 DPI eşdeğeri pixel/mm katsayısı)

KONTROL KRİTERLERİ:

1. GÖRÜNTÜ KALİTESİ (raster için)
   - Effective DPI ≥ 300 → iyi
   - 200-299 → normal (sınırda)
   - <200 → kötü
   - Blur, noise, JPEG artifacts var mı?
   - Yakın çekim görüntü kalitesi nasıl?

2. RENK
   - CMYK (baskı için ideal) — iyi
   - RGB — uyarı (renk %5-15 kayar)
   - Spot color (Pantone) — tanımlı mı?
   - Black bileşim: saf K=100 veya rich black?

3. TASARIM UYUMU
   - Bleed (3mm taşma payı) — var mı?
   - Safe zone (5mm güvenli alan) — korunmuş mu?
   - Yazılar min 5pt mi?
   - Stroke kalınlığı min 0.25pt mi?

4. GEOMETRI (özellikle sticker)
   - Cut path (bıçak yolu) ayrı katmanda mı? (sticker için kritik)
   - Path closure (kapalı şekiller)
   - İnce hatlar baskıda kaybolur mu?

VERDİCT KARAR MATRİSİ:
  - Tüm kriterler iyi → "iyi" (skor 80-100)
  - 1-2 uyarı (renk profili, küçük bleed eksikliği) → "normal" (skor 50-79)
  - Kritik sorun (düşük DPI, kırık layout) → "kotu" (skor 0-49)

ÖNEMLİ: Türkçe yanıt ver. Her finding için "actionable" çözüm öner.
Örn: "RGB → CMYK'ye Adobe Photoshop'ta 'Image > Mode > CMYK Color' ile çevir."

Eğer dosya vektörel ise (AI/EPS/SVG/PDF), effectiveDpi null bırak, görsel kontrolü yine yap (path, font, color, geometry).`;
}

// ============================================================
// Main agent function
// ============================================================

/**
 * Tasarım dosyasını AI ile analiz eder, kalite skorunu döner.
 *
 * Maliyet tahmin: GPT-4o Vision ~$0.005-0.01 per image (input).
 */
export async function runDesignQC(
  input: DesignQCInput
): Promise<DesignQCResult> {
  const start = Date.now();
  const fileType = classifyFileType(input.fileFormat);

  // Bilinmeyen format için error
  if (fileType === "unknown") {
    throw new Error(
      `Unsupported file format: ${input.fileFormat}. Allowed: PNG, JPEG, PDF, AI, EPS, SVG, PSD`
    );
  }

  // Vektörel/hibrit dosyalar için: GPT-4o Vision raster göremez.
  // MVP'de "vektörel kabul" + tahmin et + uzman gözüne yönlendir.
  // Sonraki commit'te: pdf-lib ile PDF'den page render → AI'a gönder.
  if (fileType === "vector" || fileType === "hybrid") {
    const duration = Date.now() - start;
    return {
      verdict: "normal",
      score: 65,
      fileType,
      effectiveDpi: null,
      embeddedRasterCount: 0,
      colorProfile: null,
      hasBleed: null,
      hasCutPath: null,
      isTextOutlined: null,
      visualQuality: null,
      findings: [
        {
          severity: "info",
          category: "general",
          message: `${input.fileFormat.toUpperCase()} dosyası vektörel — sonsuz çözünürlük, baskı kalitesi yüksek olasılıkla iyi.`,
          actionable:
            "Uzman gözü kontrolü için fason ortağa yönlendirildi (insan göz inceleme).",
        },
      ],
      durationMs: duration,
      model: "no-ai-vector-passthrough",
    };
  }

  // Raster dosya — Claude/GPT Vision API ile analiz
  const systemPrompt = buildSystemPrompt(input);

  try {
    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: QCAnalysisSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Bu ${input.fileFormat.toUpperCase()} formatındaki ${input.productType} tasarımını ${input.printWidthMm}×${input.printHeightMm} mm baskı boyutu için detaylı analiz et. Pixel boyutlarını gözle tahmin et, effective DPI hesapla.`,
            },
            { type: "image", image: input.fileUrl },
          ],
        },
      ],
    });

    const duration = Date.now() - start;
    const usage = (result as { usage?: { totalTokens?: number } }).usage;
    const tokensUsed = usage?.totalTokens ?? 0;

    // GPT-4o cost: input $2.50/1M tokens, output $10/1M tokens
    // Image: ~1000 tokens typical. Output: ~500 tokens.
    // Rough estimate: $0.005-0.01 per call
    const costUsd = (tokensUsed * 0.005) / 1000; // average

    return {
      ...result.object,
      durationMs: duration,
      model: "gpt-4o",
      costUsd,
    };
  } catch (err) {
    const duration = Date.now() - start;
    throw new Error(
      `Design QC agent failed: ${err instanceof Error ? err.message : "unknown"} (${duration}ms)`
    );
  }
}

/**
 * Yardımcı: dosya format mime'den string'e dönüştür.
 *
 * Örnek: "image/png" → "png", "application/pdf" → "pdf"
 */
export function mimeToFormat(mimeType: string): string {
  return mimeType
    .toLowerCase()
    .replace(/^(image|application)\//, "")
    .replace(/^x-/, "")
    .replace("jpeg", "jpeg")
    .replace("vnd.adobe.illustrator", "ai")
    .replace("postscript", "eps")
    .replace("svg+xml", "svg")
    .replace("vnd.adobe.photoshop", "psd");
}
