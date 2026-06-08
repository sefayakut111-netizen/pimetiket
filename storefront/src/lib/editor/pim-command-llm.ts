/**
 * Pim editör komut LLM — gpt-4o-mini + Zod whitelist.
 */
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  PimEditorCommandSchema,
  PimLlmOutputSchema,
  type PimEditorCommand,
} from "@/lib/editor/pim-command-schema";
import { EDITOR_MAX_MM, EDITOR_MIN_MM } from "@/lib/editor/coords";
import { OPENAI_MINI_TIMEOUT_MS } from "@/lib/http/external-timeouts";

export const STICKER_LIMITS = {
  minWidthMm: 25,
  maxWidthMm: 400,
  minHeightMm: 25,
  maxHeightMm: 650,
  minQty: 25,
  maxQty: 1000,
} as const;

function clampMm(n: number): number {
  return Math.max(EDITOR_MIN_MM, Math.min(EDITOR_MAX_MM, Math.round(n * 10) / 10));
}

/** Server-side parametre sıkıştırma — schema sonrası ikinci katman */
export function clampPimCommand(command: PimEditorCommand): PimEditorCommand {
  switch (command.action) {
    case "set_size":
      return {
        ...command,
        widthMm:
          command.widthMm != null ? clampMm(command.widthMm) : undefined,
        heightMm:
          command.heightMm != null ? clampMm(command.heightMm) : undefined,
      };
    case "set_size_from_reference":
      return {
        ...command,
        estimatedWidthMm:
          command.estimatedWidthMm != null
            ? clampMm(command.estimatedWidthMm)
            : undefined,
        estimatedHeightMm:
          command.estimatedHeightMm != null
            ? clampMm(command.estimatedHeightMm)
            : undefined,
      };
    case "set_cut_offset":
      return {
        ...command,
        offsetMm: Math.max(-2, Math.min(5, command.offsetMm)),
      };
    case "set_smoothness":
      return {
        ...command,
        smoothness: Math.max(0, Math.min(100, command.smoothness)),
      };
    case "set_image_scale":
      return {
        ...command,
        scalePct: Math.max(25, Math.min(200, command.scalePct)),
      };
    default:
      return command;
  }
}

function buildSystemPrompt(): string {
  return `Sen Pim'sin — editörde sesli kumanda gibi çalışırsın. TASARIM YAPMAZSIN.
SADECE şu aksiyonları döndürebilirsin (command alanı):
- set_size {widthMm?, heightMm?}
- set_size_from_reference {referenceKey?, estimatedWidthMm?, estimatedHeightMm?, confidence?, isEstimate?}
- set_cut_offset {offsetMm} — kesim payı mm (-2…+5)
- set_smoothness {smoothness} — kenar yumuşatma 0–100 ("kenarları yumuşat")
- apply_auto_cut {mode: "contour"|"hull"} — otomatik bıçak
- apply_shape_cut {shape: "circle"|"rect", cornerRadiusMm?} — yuvarlak/dikdörtgen kesim
- apply_template {templateId} — die-cut şablon id (örn. yuvarlak-cap50)
- toggle_layer {layer: cut|bleed|safe|white, on: bool}
- remove_background
- fit_view {mode: center|contain|cover}
- align {mode: "center"} — görseli tuvalde ortala (center_blade bıçak içindir)
- center_blade
- set_image_scale {scalePct: 25–200} — görsel ölçeği %
- suggest_product {recommended: sticker|etiket, reason}
- clarify {question} — belirsiz istek
- reject {reason} — kapsam dışı (logo çiz, metin ekle, filtre, sipariş/ödeme, döndür/çevir/geri al)

Canlı sticker sınırları: genişlik ${STICKER_LIMITS.minWidthMm}–${STICKER_LIMITS.maxWidthMm} mm, yükseklik ${STICKER_LIMITS.minHeightMm}–${STICKER_LIMITS.maxHeightMm} mm, adet ${STICKER_LIMITS.minQty}–${STICKER_LIMITS.maxQty}.
Editör tuvali: ${EDITOR_MIN_MM}–${EDITOR_MAX_MM} mm.
Döndürme (rotate), aynalama (flip) ve geri al (undo/redo) editörde YOK — bu isteklerde reject veya kısa clarify.

Kapsam dışı → reject. Belirsiz ölçü ("biraz büyüt") → clarify veya makul set_image_scale.
Tablo referansı (1 TL, kartvizit vb.) kullanıcı yazdıysa set_size_from_reference kullanma — sunucu halleder.

Few-shot:
1. "kenarları yumuşat" → set_smoothness {smoothness: 40}, reply: "Kenar yumuşatmayı artırdım."
2. "logo çiz" → reject, reason: tasarım yapamam
3. "biraz büyüt" → set_image_scale {scalePct: 115}, reply: "Görseli biraz büyüttüm (%115)."
4. "5 cm yap" → set_size {widthMm: 50, heightMm: 50}, reply: "Boyutu 50 mm yaptım."
5. "yuvarlak kes" → apply_shape_cut {shape: "circle"}, reply: "Yuvarlak kesim moduna geçtim."
6. "arka planı sil" → remove_background, reply: "Arka plan kaldırılıyor."
7. "ortala" → align {mode: "center"}, reply: "Görseli tuvalde ortaladım."
8. "sağa yatır" / "90 derece döndür" → reject, reason: döndürme henüz yok
9. "yatay çevir" / "ters çevir" → reject, reason: aynalama henüz yok
10. "kenar payını artır" → set_cut_offset {offsetMm: 2}, reply: "Kesim payını artırdım."
11. "beyaz katmanı kapat" → toggle_layer {layer: "white", on: false}, reply: "Beyaz katmanı kapattım."
12. "1 TL boyutu" → set_size_from_reference {referenceKey: "1 TL"}, reply: "1 TL boyutuna yaklaştırdım."
13. "biraz küçült" → set_image_scale {scalePct: 85}, reply: "Görseli biraz küçülttüm (%85)."
14. "sığdır" → fit_view {mode: "contain"}, reply: "Görseli tuvala sığdırdım."
15. "metin ekle" / "filtre uygula" → reject, reason: tasarım düzenleme yapamam

Marka sesi: sen-dili, kısa, net, dalkavuk yok. reply alanı her zaman dolu.`;
}

export async function resolvePimCommandWithLlm(
  message: string
): Promise<{ reply: string; command: PimEditorCommand } | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: PimLlmOutputSchema,
      system: buildSystemPrompt(),
      prompt: message.trim(),
      temperature: 0.2,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });

    const parsed = PimLlmOutputSchema.safeParse(result.object);
    if (!parsed.success) return null;

    const command = clampPimCommand(
      PimEditorCommandSchema.parse(parsed.data.command)
    );
    return { reply: parsed.data.reply.trim(), command };
  } catch (err) {
    console.error("[editor/pim-command] LLM error:", err);
    return null;
  }
}

export function buildReferenceReply(
  labelTr: string,
  widthMm: number,
  heightMm: number,
  shape: "circle" | "rect"
): string {
  if (shape === "circle") {
    return `${labelTr} ≈ ${widthMm} mm çap. Yuvarlak kesim uyguladım.`;
  }
  return `${labelTr}: ${widthMm}×${heightMm} mm boyutunu uyguladım.`;
}
