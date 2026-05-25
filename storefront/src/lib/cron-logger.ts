import { createClient } from "@supabase/supabase-js";

export async function startCronRun(cronName: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const startedAt = new Date();
  const { data } = await admin
    .from("cron_runs")
    .insert({
      cron_name: cronName,
      started_at: startedAt.toISOString(),
      status: "running",
    })
    .select("id")
    .single();

  const runId = (data as { id: string } | null)?.id;

  return {
    async complete(summary: string, itemsProcessed = 0) {
      if (!runId) return;
      const duration = Date.now() - startedAt.getTime();
      await admin
        .from("cron_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          summary,
          items_processed: itemsProcessed,
        })
        .eq("id", runId);
    },
    async fail(error: string) {
      if (!runId) return;
      const duration = Date.now() - startedAt.getTime();
      await admin
        .from("cron_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          error_message: error,
        })
        .eq("id", runId);
    },
  };
}

export interface CronRunResult<T> {
  summary: string;
  itemsProcessed?: number;
  data: T;
}

/** Cron route'larında tekrarlayan try/catch + log kalıbı */
export async function withCronRun<T>(
  cronName: string,
  handler: () => Promise<CronRunResult<T>>
): Promise<T> {
  const cron = await startCronRun(cronName);
  try {
    const result = await handler();
    await cron.complete(result.summary, result.itemsProcessed ?? 0);
    return result.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await cron.fail(msg);
    throw err;
  }
}
