/**
 * Operatör notunu müşteri-diline çevirir (Pim AI fallback).
 * QC / iptal / iade-red maillerinde kullanılır.
 */

import "server-only";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { OPENAI_MINI_TIMEOUT_MS } from "@/lib/http/external-timeouts";

const MessageSchema = z.object({
  message: z.string().max(400),
});

const SYSTEM_PROMPT = `
Sen Pim Etiket müşteri bildirim asistanısın. Operatörün iç notunu
müşteriye gidecek kısa, net Türkçe metne çevirirsin.

KURALLAR (Sefa — zorunlu):
- "sen" kullan, "siz" KULLANMA
- Dalkavuk YOK ("harika", "mükemmel" yasak)
- Yapay empati YOK ("Anlıyorum", "çok değerli" yasak)
- "Üzgünüm/Maalesef" ile başlama — önce bilgi/sonraki adım
- Teknik jargonu sadeleştir; abartma veya uydurma YOK
- Max 2-3 cümle, gerçek bilgi
- Cüzdan/puan/indirim vaadi YOK
`.trim();

const FALLBACK: Record<
  "order_cancel" | "refund_rejected",
  string
> = {
  order_cancel:
    "Siparişin iptal edildi. Ödeme yaptıysan iade süreci banka tarafında başlatılır; 3–10 iş günü içinde karta yansır.",
  refund_rejected:
    "İade talebin incelendi; mevcut bilgilerle iade koşulları karşılanmıyor. Detay için info@pimetiket.com veya iletişim formundan yazabilirsin.",
};

export async function humanizeOperatorNoteForCustomer(args: {
  operatorNote?: string | null;
  context: "order_cancel" | "refund_rejected";
  orderId?: string;
}): Promise<string> {
  const note = args.operatorNote?.trim() ?? "";
  if (!note) {
    return FALLBACK[args.context];
  }

  if (!process.env.OPENAI_API_KEY) {
    return note;
  }

  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: MessageSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        `Bağlam: ${args.context === "order_cancel" ? "sipariş iptali" : "iade talebi reddi"}`,
        args.orderId ? `Sipariş: ${args.orderId}` : "",
        `Operatör notu:\n${note}`,
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(OPENAI_MINI_TIMEOUT_MS),
    });
    const msg = result.object.message.trim();
    return msg.length > 0 ? msg : note;
  } catch (err) {
    console.warn("[mail/humanize-operator-note] AI fallback:", err);
    return note;
  }
}
