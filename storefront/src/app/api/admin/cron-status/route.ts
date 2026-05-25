import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { CRON_REGISTRY } from "@/lib/cron-registry";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request) {
  const auth = await assertPermission("settings", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const historyFor = url.searchParams.get("history");

  const admin = serviceClient();

  if (historyFor) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("cron_runs")
      .select("*")
      .eq("cron_name", historyFor)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, history: data ?? [] });
  }

  const { data: runs, error } = await admin
    .from("cron_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const latestByName = new Map<string, (typeof runs)[number]>();
  for (const run of runs ?? []) {
    const name = (run as { cron_name: string }).cron_name;
    if (!latestByName.has(name)) {
      latestByName.set(name, run);
    }
  }

  const crons = CRON_REGISTRY.map((entry) => {
    const last = latestByName.get(entry.name);
    return {
      ...entry,
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            startedAt: last.started_at,
            finishedAt: last.finished_at,
            durationMs: last.duration_ms,
            summary: last.summary,
            errorMessage: last.error_message,
            itemsProcessed: last.items_processed,
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, crons });
}
