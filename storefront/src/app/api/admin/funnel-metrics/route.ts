/**
 * /api/admin/funnel-metrics — Funnel adımları için ortalama bekleme süresi.
 *
 * Migration 012 fn_funnel_avg_durations RPC'sini çağırır.
 * Yanıt: { paid: { avgSeconds, sampleCount }, qc_pending: {...}, ... }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@/lib/supabase/server";

interface RpcRow {
  status: string;
  avg_seconds: string | number;
  sample_count: number;
}

export async function GET() {
  try {
    // Sefa 21 May v68: inline auth → assertAdmin helper (tutarlılık)
    const auth = await assertPermission("reports", "view");
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "fn_funnel_avg_durations"
    );
    if (error) {
      console.error("[funnel-metrics] rpc error:", error);
      return NextResponse.json({ metrics: {} });
    }

    const metrics: Record<string, { avgSeconds: number; sampleCount: number }> =
      {};
    for (const row of (data as RpcRow[]) ?? []) {
      metrics[row.status] = {
        avgSeconds: Number(row.avg_seconds) || 0,
        sampleCount: Number(row.sample_count) || 0,
      };
    }

    return NextResponse.json({ metrics });
  } catch (e) {
    console.error("[funnel-metrics] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
