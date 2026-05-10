/**
 * /api/admin/funnel-metrics — Funnel adımları için ortalama bekleme süresi.
 *
 * Migration 012 fn_funnel_avg_durations RPC'sini çağırır.
 * Yanıt: { paid: { avgSeconds, sampleCount }, qc_pending: {...}, ... }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RpcRow {
  status: string;
  avg_seconds: string | number;
  sample_count: number;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase.rpc(
      "fn_funnel_avg_durations" as never
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
