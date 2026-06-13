/**
 * Pim Etiket — POST /api/pim/chat
 *
 * Streaming chat endpoint. gpt-4o-mini + Vercel AI SDK.
 * Fiyat sohbette hesaplanmaz — redirect/nav + faq_lookup araçları.
 */

import * as Sentry from "@sentry/nextjs";
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  buildSystemPromptWithMemory,
  PERSONAS,
  type PimPageContext,
  type PimPersona,
} from "@/lib/pim/personas";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { OPENAI_CHAT_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createFaqLookupTool } from "@/lib/pim/faq-tool";
import { createPimNavTools } from "@/lib/pim/navigation-tools";
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
  locale?: "tr" | "en";
}

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

  const personaConfig = PERSONAS[persona];

  const clampedMessages = clampChatMessages(body.messages ?? []);
  const recentUserMsgs = clampedMessages
    .filter((m) => m.role === "user")
    .slice(-3);
  for (const msg of recentUserMsgs) {
    if (looksLikePromptInjection(extractTextFromUIMessage(msg))) {
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
  const systemPrompt = buildSystemPromptWithMemory(
    persona,
    memory,
    body.pageContext
  );
  const modelMessages = await convertToModelMessages(clampedMessages);

  const locale = body.locale === "en" ? "en" : "tr";
  const tools = personaConfig.useTools
    ? {
        ...createPimNavTools(callerUserId),
        faq_lookup: createFaqLookupTool(locale),
      }
    : {};

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
        Sentry.captureMessage("pim_chat_system_prompt_leak", {
          level: "warning",
          extra: {
            persona,
            textPreview: text.slice(0, 200),
          },
        });
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
