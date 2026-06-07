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
  type PimPageContext,
  type PimPersona,
} from "@/lib/pim/personas";
import { getSiteDeliveryDays } from "@/lib/site-settings-server";
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
import { getLivePricingConfig, PricingConfigUnavailableError } from "@/lib/pricing-config";
import {
  quoteStickerFromConfig,
  quoteEtiketFromConfig,
} from "@/lib/customer-pricing-from-config";
import {
  CUSTOMER_STICKER_TIERS,
  STICKER_MIN_QTY,
  STICKER_MAX_QTY,
  STICKER_QTY_STEP,
} from "@/lib/sticker-customer-pricing";
import { createPimNavTools } from "@/lib/pim/navigation-tools";
import {
  ETIKET_ENABLED,
  ETIKET_LAUNCH_LABEL,
  ETIKET_RULO_ENABLED,
  ETIKET_TABAKA_ENABLED,
} from "@/lib/etiket-feature-flags";
import {
  ETIKET_TABAKA_MIN_QTY,
  ETIKET_TABAKA_MAX_QTY,
} from "@/lib/etiket-customer-pricing";
import { calcTabakaSheets } from "@/lib/pricing-tabaka-geo";
import { getPricedTabakaMaterialIds } from "@/lib/pricing-materials";
import {
  clampChatMessages,
  extractTextFromUIMessage,
} from "@/lib/pim/memory-clamp";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
  PIM_DAILY_REQUEST_CAP,
} from "@/lib/pim/ai-usage-log";
import {
  looksLikePromptInjection,
  looksLikeSystemPromptLeak,
} from "@/lib/pim/chat-guard";

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
  pageContext?: PimPageContext;
}

// ============================================================
// Tool definitions — Designer Pim only
// ============================================================

const stickerTool = tool({
  description:
    `Sticker fiyatı hesapla. Serbest W×H boyut (kare veya dikdörtgen). Min 25×25mm, max 400×650mm. Adet ${STICKER_MIN_QTY}–${STICKER_MAX_QTY}, ${STICKER_QTY_STEP}'er artış (${CUSTOMER_STICKER_TIERS.join("/")}).`,
  inputSchema: z.object({
    width: z.number().min(25).max(400).describe("Sticker genişliği mm"),
    height: z.number().min(25).max(650).describe("Sticker yüksekliği mm"),
    qty: z
      .number()
      .min(STICKER_MIN_QTY)
      .max(STICKER_MAX_QTY)
      .refine(
        (n) => Number.isFinite(n) && n % STICKER_QTY_STEP === 0,
        {
          message: `Adet ${STICKER_QTY_STEP}'in katı olmalı. Geçerli örnekler: ${CUSTOMER_STICKER_TIERS.join(", ")}`,
        }
      )
      .describe(
        `Sipariş adedi (${STICKER_QTY_STEP}'er artış: ${CUSTOMER_STICKER_TIERS.join("/")})`
      ),
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
    if (qty % STICKER_QTY_STEP !== 0) {
      return {
        success: false,
        reason: `Geçersiz adet: ${qty}. ${STICKER_QTY_STEP}'in katı olmalı (ör. ${CUSTOMER_STICKER_TIERS.join(", ")}).`,
        valid_qty_examples: [...CUSTOMER_STICKER_TIERS],
      };
    }
    let config;
    try {
      config = await getLivePricingConfig("sticker");
    } catch (e) {
      if (e instanceof PricingConfigUnavailableError) {
        return {
          success: false,
          reason:
            "Fiyat şu an doğrulanamıyor, lütfen tekrar deneyin.",
        };
      }
      throw e;
    }
    const result =
      quoteStickerFromConfig(config, {
        width,
        height,
        material,
        finish,
        qty,
      }) ?? {
        ok: false as const,
        reason: "Fiyat hesaplanamadı.",
      };
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
    "Etiket fiyatı hesapla. form_factor=tabaka (250-10000 adet, sheet) veya rulo (1000-10000, rulo kapalıysa kullanma). Boyut W×H mm.",
  inputSchema: z.object({
    form_factor: z
      .enum(["rulo", "tabaka"])
      .default(ETIKET_TABAKA_ENABLED ? "tabaka" : "rulo")
      .describe("Etiket türü — tabaka (sheet) veya rulo (roll)"),
    width: z.number().min(5).max(500).describe("Etiket genişliği mm"),
    height: z.number().min(5).max(500).describe("Etiket yüksekliği mm"),
    qty: z
      .number()
      .min(ETIKET_TABAKA_MIN_QTY)
      .max(ETIKET_TABAKA_MAX_QTY)
      .describe("Sipariş adedi"),
    material_id: z
      .string()
      .default("kuse")
      .describe("Malzeme id — tabaka: kuse/kraft/beyaz/folyo (canlı config'de olanlar)"),
    coating_id: z
      .enum(["yok", "mat", "parlak", "soft"])
      .default("yok")
      .describe("Kaplama — yok/mat selefon/parlak selefon/soft touch"),
    customization_id: z
      .enum(["yok", "emboss", "yaldiz", "spotuv"])
      .default("yok")
      .describe("Özelleştirme — tabakada genelde yok; rulo için"),
  }),
  execute: async ({
    form_factor,
    width,
    height,
    qty,
    material_id,
    coating_id,
    customization_id,
  }) => {
    if (!ETIKET_ENABLED) {
      return {
        success: false,
        reason: `Etiket siparişi ${ETIKET_LAUNCH_LABEL}'da açılıyor. Şimdilik sticker tam açık — /sticker sayfasından sipariş verebilirsin.`,
        etiketDisabled: true,
      };
    }

    if (form_factor === "rulo" && !ETIKET_RULO_ENABLED) {
      return {
        success: false,
        reason: `Rulo etiket ${ETIKET_LAUNCH_LABEL}'da açılacak. Şimdilik tabaka etiket sipariş verebilirsin — form_factor=tabaka ile tekrar dene veya /etiket/yapilandir?form=tabaka.`,
        ruloDisabled: true,
      };
    }

    if (form_factor === "tabaka" && !ETIKET_TABAKA_ENABLED) {
      return {
        success: false,
        reason: "Tabaka etiket şu an sipariş alınmıyor.",
      };
    }

    if (form_factor === "tabaka") {
      if (width > TABAKA_USABLE_W_MM || height > TABAKA_USABLE_H_MM) {
        return {
          success: false,
          reason: `Tabaka net baskı alanı max ${TABAKA_USABLE_W_MM}×${TABAKA_USABLE_H_MM} mm — boyutu küçült.`,
        };
      }
      if (qty < ETIKET_TABAKA_MIN_QTY) {
        return {
          success: false,
          reason: `Tabaka etiket minimum ${ETIKET_TABAKA_MIN_QTY} adet.`,
        };
      }
    } else if (qty < 1000) {
      return {
        success: false,
        reason: "Rulo etiket minimum 1.000 adet.",
      };
    }

    const scope = form_factor === "tabaka" ? "etiket_tabaka" : "etiket_rulo";
    let config;
    try {
      config = await getLivePricingConfig(scope);
    } catch (e) {
      if (e instanceof PricingConfigUnavailableError) {
        return {
          success: false,
          reason:
            "Fiyat şu an doğrulanamıyor, lütfen tekrar deneyin.",
        };
      }
      throw e;
    }

    if (form_factor === "tabaka") {
      const pricedIds = getPricedTabakaMaterialIds(config);
      if (!pricedIds.includes(material_id)) {
        return {
          success: false,
          reason: `Malzeme "${material_id}" tabaka için şu an fiyatlandırılmıyor. Kullanılabilir: ${pricedIds.join(", ") || "—"}.`,
        };
      }
    }

    const geom = quoteEtiket({
      width,
      height,
      qty,
      materialId: material_id as "kraft",
      coatingId: coating_id,
      customizationId: form_factor === "tabaka" ? "yok" : customization_id,
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
        material: material_id as "kraft",
        coating: coating_id,
        customization: form_factor === "tabaka" ? "yok" : customization_id,
      },
      { formFactor: form_factor }
    );

    if (bridged?.ok) {
      const matName =
        config.materials.find((m) => m.id === material_id)?.name ??
        ETIKET_MATERIALS.find((m) => m.id === material_id)?.name ??
        material_id;
      const coatName =
        ETIKET_COATINGS.find((c) => c.id === coating_id)?.name ?? coating_id;
      const custName =
        form_factor === "tabaka"
          ? "Özelleştirme yok"
          : ETIKET_CUSTOMIZATIONS.find((c) => c.id === customization_id)?.name ??
            customization_id;
      return {
        success: true,
        product: "etiket",
        form_factor,
        width_mm: width,
        height_mm: height,
        qty,
        material: matName,
        coating: coatName,
        customization: custName,
        total_kdv_dahil: Math.round(bridged.total),
        unit_price_kdv_dahil: parseFloat(bridged.unitPrice.toFixed(2)),
        rolls_needed: form_factor === "rulo" ? bridged.rollsNeeded : undefined,
        sheets_needed:
          form_factor === "tabaka"
            ? calcTabakaSheets(width, height, qty)
            : undefined,
        total_m2: geom.ok
          ? parseFloat(geom.geometry.totalM2.toFixed(3))
          : 0,
        configurator_url:
          form_factor === "tabaka"
            ? "/etiket/yapilandir?form=tabaka"
            : "/etiket/yapilandir?form=rulo",
      };
    }

    if (form_factor === "tabaka") {
      return {
        success: false,
        reason:
          bridged?.reason ??
          "Tabaka fiyatı hesaplanamadı — boyut ve malzemeyi kontrol et.",
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
      configurator_url:
        form_factor === "tabaka"
          ? "/etiket/yapilandir?form=tabaka"
          : "/etiket/yapilandir?form=rulo",
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

  const dailyLimit = await rateLimit({
    key: `${limitKey}:daily`,
    limit: PIM_DAILY_REQUEST_CAP,
    windowMs: 86_400_000,
  });
  if (!dailyLimit.success) {
    return new Response(
      JSON.stringify({
        error: "daily_limit_exceeded",
        detail: "Günlük Pim mesaj limitine ulaştın. Yarın tekrar dene.",
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(dailyLimit.retryAfter),
        },
      }
    );
  }

  if (await isGlobalAiBudgetExceeded()) {
    return new Response(
      JSON.stringify({
        error: "budget_exceeded",
        detail:
          "Pim şu an yoğun — günlük AI limitine ulaşıldı. Lütfen yarın tekrar dene veya info@pimetiket.com'dan yaz.",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
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

  const clampedMessages = clampChatMessages(body.messages ?? []);
  const lastUserMsg = [...clampedMessages]
    .reverse()
    .find((m) => m.role === "user");
  if (lastUserMsg) {
    const userText = extractTextFromUIMessage(lastUserMsg);
    if (looksLikePromptInjection(userText)) {
      return new Response(
        JSON.stringify({
          error: "injection_blocked",
          detail:
            "Ben Pim'im, Pim Etiket'in asistanıyım. Etiket ve sticker konularında yardım ederim.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }
  }

  const memory = body.memory ?? {};
  const deliveryDays = await getSiteDeliveryDays();
  const systemPrompt = buildSystemPromptWithMemory(
    persona,
    memory,
    body.pageContext,
    deliveryDays
  );
  const modelMessages = await convertToModelMessages(clampedMessages);

  const tools = {
    ...createPimNavTools(callerUserId),
    ...(personaConfig.useTools
      ? {
          quote_sticker: stickerTool,
          ...(ETIKET_ENABLED ? { quote_etiket: etiketTool } : {}),
        }
      : {}),
  };

  const startedAt = Date.now();
  const result = streamText({
    model: openai(personaConfig.model),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    toolChoice: "auto",
    temperature: personaConfig.temperature,
    maxRetries: 2,
    maxOutputTokens: 800,
    abortSignal: AbortSignal.timeout(OPENAI_CHAT_TIMEOUT_MS),
    stopWhen: ({ steps }) => steps.length >= 5,
    onFinish: async ({ usage, text }) => {
      if (text && looksLikeSystemPromptLeak(text)) {
        console.warn("[pim/chat] possible system prompt leak in response");
      }
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      if (inputTokens + outputTokens > 0) {
        await logAiUsage({
          source: "pim_chat",
          model: personaConfig.model,
          inputTokens,
          outputTokens,
          userId: callerUserId,
          persona,
          durationMs: Date.now() - startedAt,
        });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
