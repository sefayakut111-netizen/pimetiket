/**
 * POST /api/loyalty/reprint-coupon
 *
 * Müşteri "Tekrar bastır" tıkladığında otomatik %10 tekrar baskı kuponu
 * oluşturur. 30 gün geçerli, tek kullanımlık.
 *
 * Body: { sourceOrderId: string }
 *   - Kullanıcı bu siparişin sahibi olmalı
 *   - 1 sipariş için 1 reprint kuponu (idempotent — aynı sourceOrderId
 *     için aynı kupon döner)
 *
 * Response: { code: string, value: number }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

interface BodyShape {
  sourceOrderId?: unknown;
}

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sourceOrderId =
    typeof body.sourceOrderId === "string" ? body.sourceOrderId.trim() : "";
  if (!sourceOrderId) {
    return NextResponse.json({ error: "sourceOrderId yok" }, { status: 400 });
  }

  // Auth
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Order kullanıcıya ait mi?
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id")
    .eq("id", sourceOrderId)
    .maybeSingle();
  if (!order || (order as { user_id: string | null }).user_id !== user.id) {
    return NextResponse.json(
      { error: "Bu siparişin sahibi değilsin" },
      { status: 403 }
    );
  }

  // Daha önce bu sipariş için reprint kuponu oluşturuldu mu?
  // Description'da sipariş id'yi tutuyoruz, böyle bul
  const description = `Tekrar baskı — ${sourceOrderId}`;
  const { data: existing } = await admin
    .from("coupons")
    .select("code, value")
    .eq("description", description)
    .eq("is_active", true)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      code: (existing as { code: string }).code,
      value: (existing as { value: number }).value,
      reused: true,
    });
  }

  // Yeni REPRINT kuponu
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const code = `REPRINT-${random}`;

  const { error: insertErr } = await admin.from("coupons").insert([
    {
      code,
      kind: "percent",
      value: 10,
      max_discount: 500, // max 500 TL indirim
      min_subtotal: 100,
      total_uses_limit: 1,
      per_user_limit: 1,
      starts_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      description,
      is_active: true,
    },
  ]);
  if (insertErr) {
    console.error("[reprint-coupon] insert error:", insertErr);
    return NextResponse.json(
      { error: "Kupon oluşturulamadı" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    code,
    value: 10,
    reused: false,
  });
}
