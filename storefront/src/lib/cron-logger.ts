import { createClient } from "@supabase/supabase-js";

function createCronAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function startCronRun(cronName: string) {
  const admin = createCronAdmin();

  const startedAt = new Date();
  const { data, error } = await admin
    .from("cron_runs")
    .insert({
      cron_name: cronName,
      started_at: startedAt.toISOString(),
      status: "running",
    })
    .select("id")
    .single();

  const noop = async () => {};

  if (error) {
    if (error.code === "23505") {
      return {
        runId: null as string | null,
        skipped: true,
        startedAt,
        complete: noop,
        fail: noop,
      };
    }
    throw error;
  }

  const runId = (data as { id: string } | null)?.id;

  return {
    runId,
    skipped: false,
    startedAt,
    complete: async (summary: string, itemsProcessed = 0) => {
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
    fail: async (errorMessage: string) => {
      if (!runId) return;
      const duration = Date.now() - startedAt.getTime();
      await admin
        .from("cron_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          error_message: errorMessage,
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

const CRON_SKIP_PAYLOAD = {
  skipped: true,
  reason: "already_running",
} as const;

/** Cron route'larında tekrarlayan try/catch + log + tek-instance kilidi */
export async function withCronRun<T>(
  cronName: string,
  handler: () => Promise<CronRunResult<T>>
): Promise<T> {
  const admin = createCronAdmin();
  const lockKey = `cron:${cronName}`;

  const { data: locked, error: lockErr } = await admin.rpc(
    "fn_with_advisory_lock",
    { p_key: lockKey }
  );

  if (lockErr) {
    console.error(`[cron:${cronName}] advisory lock error:`, lockErr.message);
  }

  if (!locked) {
    return CRON_SKIP_PAYLOAD as unknown as T;
  }

  try {
    const cron = await startCronRun(cronName);
    if (cron.skipped) {
      return CRON_SKIP_PAYLOAD as unknown as T;
    }

    try {
      const result = await handler();
      await cron.complete(result.summary, result.itemsProcessed ?? 0);
      return result.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await cron.fail(msg);
      throw err;
    }
  } finally {
    const { error: releaseErr } = await admin.rpc(
      "fn_release_advisory_lock",
      { p_key: lockKey }
    );
    if (releaseErr) {
      console.error(
        `[cron:${cronName}] advisory unlock error:`,
        releaseErr.message
      );
    }
  }
}
