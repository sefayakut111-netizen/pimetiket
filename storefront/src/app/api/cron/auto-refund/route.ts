/**
 * GET /api/cron/auto-refund
 *
 * Vercel Cron tarafından günlük 02:00'da çağrılır (vercel.json).
 *
 * 36 saatten uzun süredir prova onayı bekleyen siparişleri otomatik
 * iptal eder. PayTR refund tetikleme placeholder (gerçek implementation
 * PayTR aktivasyonu sonrası).
 *
 * Auth: CRON_SECRET env var (Vercel Cron otomatik Authorization header
 * gönderir).
 *
 * Test (manuel):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://pimetiket.com/api/cron/auto-refund
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

interface CancelledOrder {
  order_id: string;
  hours_since_proof: number;
}

export async function GET(req: Request) {
  // Vercel Cron auth — timing-safe
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase env eksik" },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // RPC çağır — 36 saat üzeri proof_pending siparişleri iptal et
  const { data, error } = await admin.rpc(
    "fn_auto_refund_stale_proofs" as never
  );

  if (error) {
    console.error("[cron/auto-refund] rpc error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cancelled = (data as CancelledOrder[]) ?? [];

  // TODO: PayTR refund tetikleme (PayTR onayı sonrası)
  // Şu an sadece status değişikliği + audit log

  // TODO: Müşteriye bildirim maili (Resend gelince)

  console.log(`[cron/auto-refund] ${cancelled.length} sipariş iptal edildi:`, cancelled);

  return NextResponse.json({
    ok: true,
    cancelled_count: cancelled.length,
    orders: cancelled,
    timestamp: new Date().toISOString(),
  });
}
