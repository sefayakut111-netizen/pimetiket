/**
 * GET /api/public/settings
 *
 * Sefa 21 May v68 — Müşteri tarafının kullandığı site ayarları.
 *
 * Daha önce `/api/admin/settings` GET kasıtlı public idi çünkü
 * sepet/odeme sayfaları bu değerleri okumak zorunda. Ancak admin
 * endpoint URL'inde public response yapısı hatalı + PII leak
 * (`updated_by`, `updated_at`) içeriyordu.
 *
 * Bu endpoint:
 *   - Sadece müşteri-görür alanları döndürür
 *   - Admin-only field'lar (updated_by, partner_auto_assign_enabled vb) gizli
 *   - 5 dk public cache header
 *   - Cookie/auth gerektirmez (UI fetch sırasında login bekleyemez)
 *
 * `/api/admin/settings` GET artık assertAdmin gerektirir.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PublicSettings {
  shipping_fee_try: number;
  free_shipping_threshold: number;
  welcome_credit_try: number;
  referral_credit_try: number;
  min_subtotal_for_credit: number;
  min_order_total_try: number;
  max_order_total_try: number;
  sticker_delivery_days: number;
  etiket_delivery_days: number;
  seo_contact_phone: string | null;
  contact_whatsapp: string | null;
}

// Migration 029 çalışmadıysa fallback default'lar
const DEFAULTS: PublicSettings = {
  shipping_fee_try: 49,
  free_shipping_threshold: 500,
  welcome_credit_try: 250,
  referral_credit_try: 250,
  min_subtotal_for_credit: 500,
  min_order_total_try: 250,
  max_order_total_try: 250000,
  sticker_delivery_days: 5,
  etiket_delivery_days: 10,
  seo_contact_phone: null,
  contact_whatsapp: null,
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Env yoksa default ile dön — UI bozulmasın
    return NextResponse.json(
      { settings: DEFAULTS, stale: true },
      {
        headers: { "Cache-Control": "public, max-age=60" }, // 1dk fallback
      }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("site_settings")
    .select(
      // SADECE müşteri-görür alanlar — id/updated_by/updated_at/admin_flags hariç
      "shipping_fee_try, free_shipping_threshold, welcome_credit_try, " +
        "referral_credit_try, min_subtotal_for_credit, " +
        "min_order_total_try, max_order_total_try, " +
        "sticker_delivery_days, etiket_delivery_days, " +
        "seo_contact_phone, contact_whatsapp"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { settings: DEFAULTS, stale: true },
      {
        headers: { "Cache-Control": "public, max-age=60" },
      }
    );
  }

  return NextResponse.json(
    { settings: data as unknown as PublicSettings },
    {
      // Settings sık değişmez, 5dk edge cache + 1sa CDN cache
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}
