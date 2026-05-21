/**
 * /api/admin/customer-stats — Admin paneli için müşteri istatistikleri.
 *
 * profiles tablosundan toplam, bu hafta, bu ay yeni kayıt sayısı.
 * Sadece role=admin/staff erişebilir.
 *
 * Yanıt:
 *   { total: 12, weekNew: 3, monthNew: 8, todayNew: 1 }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function GET() {
  try {
    // Sefa 21 May v68: inline auth check → assertAdmin helper'a refactor.
    // Tutarlılık (admin tarafı tüm endpoint'lerde aynı pattern) + DRY.
    const auth = await assertAdmin();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = await createClient();

    // Tarih aralıkları (server time)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Toplam profil sayısı (role=customer dahil)
    const { count: total } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Bu hafta yeni
    const { count: weekNew } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfWeek.toISOString());

    // Bu ay yeni
    const { count: monthNew } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString());

    // Bugün yeni
    const { count: todayNew } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
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
