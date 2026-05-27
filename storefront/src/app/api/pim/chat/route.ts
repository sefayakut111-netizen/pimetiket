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
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { OPENAI_CHAT_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  quoteSticker,
  findTier,
  quoteEtiket,
  ETIKET_MATERIALS,
  ETIKET_COATINGS,
  ETIKET_CUSTOMIZATIONS,
} from "@/lib/pricing-engine";
import { getLivePricingConfig } from "@/lib/pricing-config";
import {
  quoteStickerFromConfig,
  quoteEtiketFromConfig,
} from "@/lib/customer-pricing-from-config";
import { quoteCustomerSticker } from "@/lib/sticker-customer-pricing";
import { createPimNavTools } from "@/lib/pim/navigation-tools";

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
    const config = await getLivePricingConfig("sticker");
    const result =
      quoteStickerFromConfig(config, {
        width,
        height,
        material,
        finish,
        qty,
      }) ??
      quoteCustomerSticker({
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
      configurator_url: "/sticker",
    };
  },
});

const etiketTool = tool({
  description:
    "Etiket fiyatı hesapla. Rulo etiket (tabaka YOK). Min 1000 adet, max 25000. Boyut serbest (W×H mm).",
  inputSchema: z.object({
    width: z.number().min(5).max(520).describe("Etiket genişliği mm"),
    height: z.number().min(5).max(1470).describe("Etiket yüksekliği mm"),
    qty: z
      .number()
      .min(1000)
      .max(25000)
      .describe("Sipariş adedi (1K/2K/5K/10K/20K/25K önerilen)"),
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
    const config = await getLivePricingConfig("etiket_rulo");
    const geom = quoteEtiket({
      width,
      height,
      qty,
      materialId: material_id,
      coatingId: coating_id,
      customizationId: customization_id,
      production: { mode: "fason", rate: 100 },
      operation: { setup: 0, packaging: 0, cargo: 0, feePct: 0 },
      margin: { marginPct: 0, vatPct: 0, minMarkupFraction: 0 },
    });
    const bridged = quoteEtiketFromConfig(
      config,
      {
        width,
        height,
        qty,
        material: material_id,
        coating: coating_id,
        customization: customization_id,
      },
      { formFactor: "rulo" }
    );

    if (bridged?.ok) {
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
        total_kdv_dahil: Math.round(bridged.total),
        unit_price_kdv_dahil: parseFloat(bridged.unitPrice.toFixed(2)),
        rolls_needed: bridged.rollsNeeded,
        total_m2: geom.ok
          ? parseFloat(geom.geometry.totalM2.toFixed(3))
          : 0,
        configurator_url: "/etiket",
      };
    }

    const result = quoteEtiket({
      width,
      height,
      qty,
      materialId: material_id,
      coatingId: coating_id,
      customizationId: customization_id,
      production: { mode: "fason", rate: 120 },
      operation: {
        setup: 100,
        packaging: 25,
        cargo: 0,
        feePct: 0,
      },
      margin: {
        marginPct: 0,
        vatPct: 20,
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
        error: "service_unavailable",
        detail: "Pim şu an kullanılamıyor. Lütfen daha sonra tekrar dene.",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }

  // Rate limit (audit P0 12 May): kullanıcı id varsa öncelikli, yoksa IP.
  // Anonim guest agresif spam yapamasın diye dakikada 12 mesaj limit.
  // Upstash env varsa cluster-safe, yoksa in-memory fallback (cold start
  // sayacı sıfırlar — küçük leak ama maliyet kontrolü için yeterli).
  let limitKey = `chat:ip:${getClientIp(req)}`;
  let callerUserId: string | null = null;
  try {
    const supa = await createServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (user?.id) {
      callerUserId = user.id;
      limitKey = `chat:user:${user.id}`;
    }
  } catch {
    /* anonim olarak devam */
  }
  const limit = await rateLimit({
    key: limitKey,
    limit: 12,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return new Response(
      JSON.stringify({
        error: "rate_limit_exceeded",
        detail: "Dakikada en fazla 12 mesaj. Lütfen biraz bekle.",
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(limit.retryAfter),
          "x-ratelimit-limit": String(limit.limit),
          "x-ratelimit-remaining": String(limit.remaining),
        },
      }
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

  // Persona-specific routing: model + temperature + tool kullanımı
  // Maliyet optimizasyonu — welcome/shipper mini'de, designer tools için 4o'da.
  const personaConfig = PERSONAS[persona];

  const memory = body.memory ?? {};
  const systemPrompt = buildSystemPromptWithMemory(persona, memory);
  const modelMessages = await convertToModelMessages(body.messages);

  const tools = {
    ...createPimNavTools(callerUserId),
    ...(personaConfig.useTools
      ? { quote_sticker: stickerTool, quote_etiket: etiketTool }
      : {}),
  };

  const result = streamText({
    model: openai(personaConfig.model),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    toolChoice: "auto",
    temperature: personaConfig.temperature,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(OPENAI_CHAT_TIMEOUT_MS),
    stopWhen: ({ steps }) => steps.length >= 5,
  });

  return result.toUIMessageStreamResponse();
}
