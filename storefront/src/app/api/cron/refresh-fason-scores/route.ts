/**
 * GET /api/cron/refresh-fason-scores
 *
 * Vercel daily cron — fason performans skorlarını günceller.
 * Migration 021 fn_refresh_fason_scores() RPC çağırır.
 *
 * Schedule: vercel.json içinde "0 3 * * *" (her gün 03:00).
 * Auth: CRON_SECRET (otomatik header).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase eksik" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc(
    "fn_refresh_fason_scores"
  );

  if (error) {
    console.error("[cron/refresh-fason-scores] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updates = (data as Array<{
    fason_id: string;
    fason_name: string;
    new_score: number;
  }>) ?? [];

  // Outbox payload TTL — KVKK saklama minimizasyonu (Migration 025)
  // Aynı daily cron'a piggy-back: 30 günden eski sent/failed kayıtların
  // payload jsonb'ini NULL'lar (order_id + fason_token gibi PII içerir).
  let outboxCleaned: number | null = null;
  try {
    const { data: cleaned } = await admin.rpc(
      "fn_cleanup_outbox_payload"
    );
    outboxCleaned = (cleaned as number) ?? null;
  } catch (err) {
    console.error("[cron/refresh-fason-scores] outbox cleanup error:", err);
  }

  return NextResponse.json({
    ok: true,
    updated: updates.length,
    scores: updates,
    outbox_payload_cleaned: outboxCleaned,
    timestamp: new Date().toISOString(),
  });
}
