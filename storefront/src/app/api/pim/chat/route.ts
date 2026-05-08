/**
 * Pim Etiket — POST /api/pim/chat
 *
 * Streaming chat endpoint. GPT-4o + Vercel AI SDK.
 * Memory snapshot client'tan gelir (anonim user, localStorage).
 *
 * Auth + Supabase memory geldiğinde request body'den userId alınır,
 * server-side fact recall yapılır.
 */

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  buildSystemPromptWithMemory,
  PERSONAS,
  type PimPersona,
} from "@/lib/pim/personas";

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

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: modelMessages,
    temperature: 0.7,
    maxRetries: 2,
  });

  return result.toUIMessageStreamResponse();
}
