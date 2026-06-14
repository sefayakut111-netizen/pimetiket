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

/** Cron route'larında tekrarlayan try/catch + log + tek-instance kilidi.
 *  Tek-instance: cron_runs_one_running_per_name partial unique index (Mig 180).
 *  Advisory lock KALDIRILDI (14 Haz): pg_try_advisory_lock session-scoped + supabase-js
 *  RPC'leri PostgREST'in havuzlanmış bağlantılarında çalışır → lock COMMIT'te düşmez,
 *  release farklı bağlantıya gidebilir → sızar → cron'lar yanlışlıkla 'already_running'
 *  ile atlanır. Gerçek garanti unique index'te (startCronRun 23505 → skip). */
export async function withCronRun<T>(
  cronName: string,
  handler: () => Promise<CronRunResult<T>>
): Promise<T> {
  const admin = createCronAdmin();

  // stale 'running' reaper: crash/timeout'ta takılı kalan kaydı 'error' yap.
  // startCronRun INSERT'inden ÖNCE çalışır; aksi halde takılı 'running' unique index'i
  // bloklar. 30dk cutoff: en uzun cron maxDuration=300sn ≪ 30dk → meşru uzun-run asla
  // 'error' işaretlenmez. Terminal status 'error' (cron_runs CHECK 'failed' kabul etmez).
  // Koşulsuz çalışır (eski advisory-lock gate kalktı): idempotent — yalnız 30dk+ satırları
  // etkiler; eşzamanlı iki reaper aynı satırı yarıştırırsa ikincisi 0 satır eşler.
  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { error: reapErr } = await admin
    .from("cron_runs")
    .update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_message: "stale_running_reaped (30dk+ tamamlanmadı — crash/timeout)",
    })
    .eq("cron_name", cronName)
    .eq("status", "running")
    .lt("started_at", staleCutoff);
  if (reapErr) {
    console.error(`[cron:${cronName}] stale-running reap error:`, reapErr.message);
  }

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
}
