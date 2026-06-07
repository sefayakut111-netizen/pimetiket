/**
 * GET /api/loyalty/me
 *
 * Kullanıcının sadakat durumu:
 *   - VIP statüsü (vip_since)
 *   - Referans kodu (referral_code)
 *   - Referrals listesi (kimi davet etti, tamamlandı mı)
 *   - Aktif kuponlar (yorum bonus + referans kuponları)
 *   - Sipariş sayısı
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
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

  // Profile
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, display_name, vip_since, referral_code, referred_by_user_id, role"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile bulunamadı" }, { status: 404 });
  }

  // Eğer referral_code yoksa otomatik üret
  let referralCode = (profile as { referral_code: string | null }).referral_code;
  if (!referralCode) {
    const { data: code } = await admin.rpc(
      "fn_generate_referral_code",
      { p_user_id: user.id }
    );
    referralCode = (code as string) ?? null;
  }

  // Sipariş sayısı (iptal hariç)
  const { count: orderCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "cancelled");

  // Davet ettikleri
  const { data: invited } = await admin
    .from("referrals")
    .select(
      "id, referred_user_id, status, referrer_coupon_code, referred_coupon_code, created_at, completed_at"
    )
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Kullanıcının aktif sadakat kuponları — sadece kendisine atanmış (M7 PARA-FIX)
  const { data: coupons } = await admin
    .from("coupons")
    .select(
      "id, code, kind, value, max_discount, min_subtotal, expires_at, description, is_active"
    )
    .eq("target_user_id", user.id)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(50);

  // Bu kuponlardan müşterinin kullandıklarını filtrele (coupon_uses tablosu coupon_id ile bağlıyor)
  const couponIds = (coupons ?? []).map((c: { id: string }) => c.id);
  const { data: uses } = await admin
    .from("coupon_uses")
    .select("coupon_id")
    .eq("user_id", user.id)
    .in("coupon_id", couponIds.length > 0 ? couponIds : ["__none__"]);

  const usedSet = new Set(
    (uses ?? []).map((u: { coupon_id: string }) => u.coupon_id)
  );
  const availableCoupons = (coupons ?? []).filter(
    (c: { id: string }) => !usedSet.has(c.id)
  );

  return NextResponse.json({
    vipSince: (profile as { vip_since: string | null }).vip_since,
    referralCode,
    referredByUserId: (profile as { referred_by_user_id: string | null })
      .referred_by_user_id,
    orderCount: orderCount ?? 0,
    invited: invited ?? [],
    availableCoupons,
  });
}
