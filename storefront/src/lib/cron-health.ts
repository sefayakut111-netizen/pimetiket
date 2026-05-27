/**
 * Cron sağlık özeti — dashboard strip ile cron izleme sayfası aynı mantığı kullanır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CRON_REGISTRY } from "./cron-registry";

const SKIPPED_CRONS = new Set(["auditors-agent"]);

export async function summarizeCronHealth(
  admin: SupabaseClient
): Promise<{
  total: number;
  healthy: number;
  error: number;
  lastError?: string;
}> {
  const total = CRON_REGISTRY.filter((e) => !SKIPPED_CRONS.has(e.name)).length;

  const { data: runs } = await admin
    .from("cron_runs")
    .select("cron_name, status, error_message, started_at")
    .order("started_at", { ascending: false })
    .limit(200);

  const latestByName = new Map<
    string,
    { status: string; error_message?: string | null }
  >();
  for (const run of runs ?? []) {
    const name = (run as { cron_name: string }).cron_name;
    if (!latestByName.has(name)) {
      latestByName.set(name, run as { status: string; error_message?: string | null });
    }
  }

  let cronError = 0;
  let lastError: string | undefined;

  for (const entry of CRON_REGISTRY) {
    if (SKIPPED_CRONS.has(entry.name)) continue;
    const last = latestByName.get(entry.name);
    if (last?.status === "error") {
      cronError++;
      if (!lastError && last.error_message) {
        lastError = last.error_message;
      }
    }
  }

  return {
    total,
    healthy: Math.max(0, total - cronError),
    error: cronError,
    lastError,
  };
}
