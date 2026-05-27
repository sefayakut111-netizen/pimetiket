/**
 * Cron sağlık özeti — dashboard strip ile cron izleme sayfası aynı mantığı kullanır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CRON_REGISTRY } from "./cron-registry";

export interface CronFailureSummary {
  name: string;
  label: string;
  error?: string;
}

export async function summarizeCronHealth(
  admin: SupabaseClient
): Promise<{
  total: number;
  healthy: number;
  error: number;
  lastError?: string;
  failures: CronFailureSummary[];
}> {
  const total = CRON_REGISTRY.length;

  const { data: runs } = await admin
    .from("cron_runs")
    .select("cron_name, status, error_message, started_at, finished_at")
    .order("started_at", { ascending: false })
    .limit(200);

  const latestByName = new Map<
    string,
    {
      status: string;
      error_message?: string | null;
      started_at?: string;
      finished_at?: string | null;
    }
  >();
  for (const run of runs ?? []) {
    const name = (run as { cron_name: string }).cron_name;
    if (!latestByName.has(name)) {
      latestByName.set(
        name,
        run as {
          status: string;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
        }
      );
    }
  }

  let cronError = 0;
  let lastError: string | undefined;
  const failures: CronFailureSummary[] = [];

  for (const entry of CRON_REGISTRY) {
    const last = latestByName.get(entry.name);
    if (last?.status === "error") {
      cronError++;
      const errMsg = last.error_message ?? undefined;
      if (!lastError && errMsg) {
        lastError = errMsg;
      }
      failures.push({
        name: entry.name,
        label: entry.label,
        error: errMsg,
      });
    }
  }

  return {
    total,
    healthy: Math.max(0, total - cronError),
    error: cronError,
    lastError,
    failures,
  };
}

const AUTO_REFUND_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** auto-refund cron son 48 saat içinde başarılı çalıştı mı */
export async function isAutoRefundCronHealthy(
  admin: SupabaseClient
): Promise<boolean> {
  const { data: runs } = await admin
    .from("cron_runs")
    .select("status, started_at, finished_at")
    .eq("cron_name", "auto-refund")
    .order("started_at", { ascending: false })
    .limit(20);

  const lastSuccess = (runs ?? []).find((r) => r.status === "success");
  if (!lastSuccess) return false;

  const ts = lastSuccess.finished_at ?? lastSuccess.started_at;
  if (!ts) return false;

  return Date.now() - new Date(ts).getTime() < AUTO_REFUND_MAX_AGE_MS;
}
