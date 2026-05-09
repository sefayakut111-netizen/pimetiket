/**
 * Pim Etiket — POST /api/pim/chat
 *
 * Streaming chat endpoint. GPT-4o + Vercel AI SDK.
 * Memory snapshot client'tan gelir (anonim user, localStorage).
 *
 * Faz 2 (Yön 4): Designer Pim için tool calling — quote_sticker /
 * quote_etiket. Server-side pricing engine çağrılır, customer-friendly
 * çıktı LLM'e döndürülür, LLM doğal dilde özetler.
 */

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import {
  buildSystemPromptWithMemory,
  PERSONAS,
  type PimPersona,
} from "@/lib/pim/personas";
import {
  quoteSticker,
  findTier,
  quoteEtiket,
  ETIKET_MATERIALS,
  ETIKET_COATINGS,
  ETIKET_CUSTOMIZATIONS,
} from "@/lib/pricing-engine";
import { getDefaultInput } from "@/lib/pricing-profiles";
import { quoteCustomerSticker } from "@/lib/sticker-customer-pricing";

export const runtime = "nodejs";
export const maxDuration = 30;

interface MemorySnapshot {
  displayName?: string;
  facts?: Array<{ key: string; value: string }>;
  lastConversationSummary?: string;
}

interface ChatRequestBody {
  messages: UIMessage[];
  persona?: PimPersona;
  memory?: MemorySnapshot;
}

// ============================================================
// Tool definitions — Designer Pim only
// ============================================================

const stickerTool = tool({
  description:
    "Sticker fiyatı hesapla. Serbest W×H boyut (kare veya dikdörtgen). Min 25×25mm, max 400×650mm. Min 25 adet, max 1000 (25'er artış).",
  inputSchema: z.object({
    width: z.number().min(25).max(400).describe("Sticker genişliği mm"),
    height: z.number().min(25).max(650).describe("Sticker yüksekliği mm"),
    qty: z
      .number()
      .min(25)
      .max(1000)
      .describe("Sipariş adedi (25'er artış: 25/50/75/100/250/500/1000…)"),
    material: z
      .enum(["vinil", "transparan", "holo", "simli"])
      .default("vinil")
      .describe("Sticker malzemesi (vinil/transparan/holografik/simli)"),
    finish: z
      .enum(["parlak", "mat", "yok"])
      .default("parlak")
      .describe("Yüzey kaplaması (parlak / mat / yok=kaplamasız)"),
  }),
  execute: async ({ width, height, qty, material, finish }) => {
    const result = quoteCustomerSticker({
      width,
      height,
      material,
      finish,
      qty,
    });
    if (!result.ok) {
      return {
        success: false,
        reason: result.reason,
        bigEtiketRedirect: result.bigEtiketRedirect ?? false,
      };
    }
    return {
      success: true,
      product: "sticker",
      size_mm: `${width}×${height}`,
      qty,
      material,
      finish,
      total_kdv_dahil: Math.round(result.total),
      unit_price_kdv_dahil: parseFloat(result.unitPrice.toFixed(2)),
      hediye_adet: result.overrunCount,
      tier_multiplier: result.tierMultiplier,
      cuzdan_indirim_2pct: parseFloat(
        (result.total * 0.02).toFixed(2)
      ),
      configurator_url: "/sticker",
    };
  },
});

const etiketTool = tool({
  description:
    "Etiket fiyatı hesapla. Rulo etiket (tabaka YOK). Min 1000 adet, max 50000. Boyut serbest (W×H mm).",
  inputSchema: z.object({
    width: z.number().min(5).max(520).describe("Etiket genişliği mm"),
    height: z.number().min(5).max(1470).describe("Etiket yüksekliği mm"),
    qty: z
      .number()
      .min(1000)
      .max(50000)
      .describe("Sipariş adedi (1K/2K/5K/10K/20K/50K önerilen)"),
    material_id: z
      .enum(["kraft", "beyaz", "ultra", "metalik"])
      .default("kraft")
      .describe("Malzeme — kraft/beyaz semi-glos/ultra clear/metalik"),
    coating_id: z
      .enum(["yok", "mat", "parlak", "soft"])
      .default("yok")
      .describe("Kaplama — yok/mat selefon/parlak selefon/soft touch"),
    customization_id: z
      .enum(["yok", "emboss", "yaldiz", "spotuv"])
      .default("yok")
      .describe("Özelleştirme — yok/emboss/yaldız/spot UV"),
  }),
  execute: async ({
    width,
    height,
    qty,
    material_id,
    coating_id,
    customization_id,
  }) => {
    const defaults = getDefaultInput();
    const result = quoteEtiket({
      width,
      height,
      qty,
      materialId: material_id,
      coatingId: coating_id,
      customizationId: customization_id,
      production: { mode: "fason", rate: defaults.fasonRate },
      operation: {
        setup: 100,
        packaging: 25,
        cargo: 100,
        feePct: defaults.feePct,
      },
      margin: {
        marginPct: defaults.marginPct,
        vatPct: defaults.vatPct,
        minMarkupFraction: 0,
      },
    });
    if (!result.ok) {
      return { success: false, reason: result.reason };
    }
    const matName =
      ETIKET_MATERIALS.find((m) => m.id === material_id)?.name ?? material_id;
    const coatName =
      ETIKET_COATINGS.find((c) => c.id === coating_id)?.name ?? coating_id;
    const custName =
      ETIKET_CUSTOMIZATIONS.find((c) => c.id === customization_id)?.name ??
      customization_id;
    return {
      success: true,
      product: "etiket",
      width_mm: width,
      height_mm: height,
      qty,
      material: matName,
      coating: coatName,
      customization: custName,
      total_kdv_dahil: Math.round(result.cost.total),
      unit_price_kdv_dahil: parseFloat(result.cost.unitPrice.toFixed(2)),
      rolls_needed: result.geometry.rollsNeeded,
      total_m2: parseFloat(result.geometry.totalM2.toFixed(3)),
      cuzdan_indirim_2pct: parseFloat(
        (result.cost.total * 0.02).toFixed(2)
      ),
      configurator_url: "/etiket",
    };
  },
});

// Suppress unused — findTier kept for potential future tool extensions
void findTier;

// ============================================================
// POST handler
// ============================================================

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "OPENAI_API_KEY env eksik. .env.local'e ekle.",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const persona = body.persona ?? "welcome";
  if (!(persona in PERSONAS)) {
    return new Response(JSON.stringify({ error: "Unknown persona" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const memory = body.memory ?? {};
  const systemPrompt = buildSystemPromptWithMemory(persona, memory);
  const modelMessages = await convertToModelMessages(body.messages);

  // Designer için tool'ları aktive et
  const tools = persona === "designer"
    ? { quote_sticker: stickerTool, quote_etiket: etiketTool }
    : undefined;

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    // Designer'a tool kullanmasına teşvik
    toolChoice: persona === "designer" ? "auto" : undefined,
    temperature: 0.7,
    maxRetries: 2,
    stopWhen: ({ steps }) => steps.length >= 5,
  });

  return result.toUIMessageStreamResponse();
}
