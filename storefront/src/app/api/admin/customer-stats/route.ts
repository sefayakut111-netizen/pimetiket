/**
 * /api/admin/customer-stats — Admin paneli için müşteri istatistikleri.
 *
 * profiles tablosundan role=customer kayıtları — toplam, bu hafta, bu ay, bugün.
 *
 * Yanıt:
 *   { total: 12, weekNew: 3, monthNew: 8, todayNew: 1 }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await assertPermission("customers", "view");
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = createAdminClient();

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: total } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer");

    const { count: weekNew } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", startOfWeek.toISOString());

    const { count: monthNew } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", startOfMonth.toISOString());

    const { count: todayNew } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", startOfDay.toISOString());

    return NextResponse.json({
      total: total ?? 0,
      weekNew: weekNew ?? 0,
      monthNew: monthNew ?? 0,
      todayNew: todayNew ?? 0,
    });
  } catch (e) {
    console.error("[customer-stats] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
