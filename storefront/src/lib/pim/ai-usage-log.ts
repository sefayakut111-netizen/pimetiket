/**
 * Pim / OpenAI kullanım logu — maliyet görünürlüğü + günlük bütçe guard.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type AiUsageSource =
  | "pim_chat"
  | "pim_summarize"
  | "support_classify"
  | "search_intent"
  | "image_upscale";

export const PIM_MODEL_PRICING = {
  "gpt-4o": { inputPerM: 2.5, outputPerM: 10 },
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
} as const;

/** Günlük istek tavanı (IP veya user başına). */
export const PIM_DAILY_REQUEST_CAP = 200;

/** Tüm OpenAI harcaması için günlük Pim kapatma eşiği (USD). */
export const PIM_GLOBAL_DAILY_BUDGET_USD = 5.0;

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing =
    PIM_MODEL_PRICING[model as keyof typeof PIM_MODEL_PRICING] ??
    PIM_MODEL_PRICING["gpt-4o-mini"];
  return (
    (inputTokens * pricing.inputPerM + outputTokens * pricing.outputPerM) /
    1_000_000
  );
}

function startOfTodayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function logAiUsage(entry: {
  source: AiUsageSource;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  userId?: string | null;
  persona?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const inputTokens = Math.max(0, entry.inputTokens);
    const outputTokens = Math.max(0, entry.outputTokens);
    const costUsd =
      entry.costUsd ??
      estimateCostUsd(entry.model, inputTokens, outputTokens);

    await admin.from("ai_usage_logs").insert({
      source: entry.source,
      model: entry.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      tokens_used: inputTokens + outputTokens,
      cost_usd: costUsd,
      user_id: entry.userId ?? null,
      persona: entry.persona ?? null,
      duration_ms: entry.durationMs ?? null,
    });
  } catch (err) {
    console.error("[ai-usage-log] insert failed:", err);
  }
}

/** Pim chat + summarize + Design QC — bugünkü toplam USD. */
export async function getTodayOpenAiSpendUsd(): Promise<number> {
  try {
    const admin = createAdminClient();
    const since = startOfTodayUtc();

    const [usageRes, qcRes] = await Promise.all([
      admin
        .from("ai_usage_logs")
        .select("cost_usd")
        .gte("created_at", since),
      admin
        .from("design_quality_checks")
        .select("cost_usd")
        .gte("created_at", since),
    ]);

    const usageRows = (usageRes.data ?? []) as Array<{
      cost_usd: number | string | null;
    }>;
    const qcRows = (qcRes.data ?? []) as Array<{
      cost_usd: number | string | null;
    }>;

    const sum = (rows: Array<{ cost_usd: number | string | null }>) =>
      rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

    return sum(usageRows) + sum(qcRows);
  } catch (err) {
    console.error("[ai-usage-log] budget check failed:", err);
    return 0;
  }
}

export async function isGlobalAiBudgetExceeded(): Promise<boolean> {
  const spend = await getTodayOpenAiSpendUsd();
  return spend >= PIM_GLOBAL_DAILY_BUDGET_USD;
}
