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

export interface CronStaleEntry {
  name: string;
  label: string;
  lastSuccessAt: string | null;
  maxStaleMs: number;
}

/** CRON_REGISTRY schedule'dan tolerans (ms) — günlük 26h, haftalık 8g, aylık 35g */
export function maxStaleMsFromSchedule(schedule: string): number {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return 26 * 3_600_000;
  const [, , dom, , dow] = parts;
  if (dom !== "*") return 35 * 86_400_000;
  if (dow !== "*") return 8 * 86_400_000;
  return 26 * 3_600_000;
}

/** Son başarılı cron_runs kaydı toleransı aşan registry girdileri */
export async function findStaleCrons(
  admin: SupabaseClient
): Promise<CronStaleEntry[]> {
  const stale: CronStaleEntry[] = [];

  for (const entry of CRON_REGISTRY) {
    const maxStaleMs = maxStaleMsFromSchedule(entry.schedule);
    const cutoff = new Date(Date.now() - maxStaleMs).toISOString();

    const { data: runs } = await admin
      .from("cron_runs")
      .select("status, started_at, finished_at")
      .eq("cron_name", entry.name)
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1);

    const last = (runs ?? [])[0] as
      | { started_at?: string; finished_at?: string | null }
      | undefined;
    const lastTs = last?.finished_at ?? last?.started_at ?? null;

    if (!lastTs || lastTs < cutoff) {
      stale.push({
        name: entry.name,
        label: entry.label,
        lastSuccessAt: lastTs,
        maxStaleMs,
      });
    }
  }

  return stale;
}
