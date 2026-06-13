/**
 * POST /api/pim/summarize — uzun sohbet geçmişini özetle (gpt-4o-mini)
 *
 * history > 20 mesajda en eski yarıyı özetler, last_summary günceller.
 */
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  clampHistory,
  clampMemoryPayload,
  MAX_SUMMARY_CHARS,
} from "@/lib/pim/memory-clamp";
import type { PimFact, PimMessage } from "@/lib/pim/memory";
import { OPENAI_CHAT_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";

export const runtime = "nodejs";
export const maxDuration = 30;

const SUMMARIZE_THRESHOLD = 20;

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit({
    key: `pim-sum:${user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("pim_conversations")
    .select("display_name, facts, history, last_summary")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[pim/summarize] fetch", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_row" });
  }

  const history = Array.isArray(row.history)
    ? (row.history as unknown as PimMessage[])
    : [];

  if (history.length <= SUMMARIZE_THRESHOLD) {
    return NextResponse.json({ ok: true, skipped: true, reason: "below_threshold" });
  }

  const half = Math.floor(history.length / 2);
  const toSummarize = history.slice(0, half);
  const keep = history.slice(half);
  const priorSummary =
    typeof row.last_summary === "string" ? row.last_summary : "";

  const transcript = toSummarize
    .map((m) => `${m.role === "user" ? "Müşteri" : "Pim"}: ${m.content}`)
    .join("\n");

  const system =
    "Bu sohbeti 2-3 cümlede özetle. Müşterinin tercihleri ve bağlam korunsun. Türkçe, kısa, samimi ama dalkavuk değil.";

  const userPrompt = priorSummary
    ? `Önceki özet:\n${priorSummary}\n\nYeni mesajlar:\n${transcript}`
    : `Mesajlar:\n${transcript}`;

  if (await isGlobalAiBudgetExceeded()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ai_budget_exceeded",
    });
  }

  let summaryText: string;
  const startedAt = Date.now();
  try {
    const { text, usage } = await generateText({
      model: openai("gpt-4o-mini"),
      system,
      prompt: userPrompt,
      abortSignal: AbortSignal.timeout(OPENAI_CHAT_TIMEOUT_MS),
    });
    summaryText = text.trim().slice(0, MAX_SUMMARY_CHARS);
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    if (inputTokens + outputTokens > 0) {
      await logAiUsage({
        source: "pim_summarize",
        model: "gpt-4o-mini",
        inputTokens,
        outputTokens,
        userId: user.id,
        durationMs: Date.now() - startedAt,
      });
    }
  } catch (err) {
    console.error("[pim/summarize] openai", err);
    return NextResponse.json({ error: "summarize_failed" }, { status: 502 });
  }

  const clamped = clampMemoryPayload({
    displayName: row.display_name as string | null,
    facts: Array.isArray(row.facts) ? (row.facts as unknown as PimFact[]) : [],
    history: clampHistory(keep),
    lastSummary: summaryText,
  });

  const { error: updateErr } = await supabase
    .from("pim_conversations")
    .update({
      history: (clamped.history ?? []) as unknown as import("@/lib/supabase/types").Json,
      last_summary: clamped.lastSummary ?? null,
    })
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[pim/summarize] update", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    summarized: toSummarize.length,
    remaining: keep.length,
  });
}
