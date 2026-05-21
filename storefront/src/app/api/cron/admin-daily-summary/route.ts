/**
 * GET /api/cron/admin-daily-summary
 *
 * Sefa 21 May v68 — Admin günlük operasyon özeti.
 * Sabah 09:00 TR (UTC 06:00) — Sefa kahvesini içerken günün özetini görür.
 *
 * Mail içeriği:
 *   - Dün gece + bugün gelen yeni siparişler (sayı + ciro)
 *   - Bekleyen kuyruklar (AI QC, prova, awaiting_upload, üretim)
 *   - Kritik uyarılar (>24sa awaiting_upload, failed QC, SLA tehlike)
 *   - Partner kapasite uyarısı (%85+ doluluk)
 *
 * ADMIN_NOTIFICATION_EMAIL set değilse skip.
 * Resend yoksa outbox'a düşer, gönderim olmaz.
 *
 * Auth: CRON_SECRET Bearer header (Vercel Cron otomatik).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { enqueueMail } from "@/lib/mail/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DailySummaryData {
  newOrders24h: number;
  revenue24h: number;
  awaitingUpload: number;
  awaitingUploadStale: number; // >24sa awaiting_upload
  aiQcQueue: number;
  proofPending: number;
  inProduction: number;
  shipped24h: number;
  partnerCapacityWarn: number; // %85+ kapasite dolu partner sayısı
}

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminEmails.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: "ADMIN_NOTIFICATION_EMAIL env yok",
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase env eksik" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // 1) Son 24 saat siparişler + ciro
  const { data: newOrdersData } = await admin
    .from("orders")
    .select("total")
    .gte("created_at", dayAgo);
  const newOrders = ((newOrdersData ?? []) as Array<{ total: number | string }>);
  const newOrders24h = newOrders.length;
  const revenue24h = newOrders.reduce(
    (sum, o) => sum + (Number(o.total) || 0),
    0
  );

  // 2) Kuyruk sayımları (statü bazlı head:true count)
  const statusCount = async (status: string): Promise<number> => {
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    return count ?? 0;
  };

  const awaitingUpload = await statusCount("awaiting_upload");
  const aiQcQueue =
    (await statusCount("qc_pending")) +
    (await statusCount("qc_flagged")) +
    (await statusCount("operator_review"));
  const proofPending = await statusCount("proof_pending");
  const inProduction = await statusCount("in_production");

  // 3) Son 24 saat kargolanan
  const { count: shipped24hCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "shipped")
    .gte("shipped_at", dayAgo);
  const shipped24h = shipped24hCount ?? 0;

  // 4) Stale awaiting_upload (>24sa)
  const { count: staleCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "awaiting_upload")
    .lte("paid_at", dayAgo);
  const awaitingUploadStale = staleCount ?? 0;

  // 5) Partner kapasite uyarısı (%85+)
  // partner_capacity_usage view veya benzeri yoksa basit hesap:
  // active assignments / capacity_per_week
  type PartnerRow = {
    id: string;
    name: string;
    capacity_per_week: number | null;
  };
  const { data: partnersData } = await admin
    .from("partners")
    .select("id, name, capacity_per_week")
    .eq("is_active", true);
  const partners = (partnersData ?? []) as PartnerRow[];

  let partnerCapacityWarn = 0;
  for (const p of partners) {
    if (!p.capacity_per_week || p.capacity_per_week <= 0) continue;
    const { count: activeCount } = await admin
      .from("order_assignments")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", p.id)
      .in("status", ["pending", "in_progress"]);
    if ((activeCount ?? 0) >= p.capacity_per_week * 0.85) {
      partnerCapacityWarn++;
    }
  }

  const data: DailySummaryData = {
    newOrders24h,
    revenue24h,
    awaitingUpload,
    awaitingUploadStale,
    aiQcQueue,
    proofPending,
    inProduction,
    shipped24h,
    partnerCapacityWarn,
  };

  // 6) Her admin için outbox kaydı
  let sent = 0;
  for (const to of adminEmails) {
    const result = await enqueueMail({
      to,
      templateKey: "admin_daily_summary",
      category: "admin",
      payload: { ...data, generated_at: new Date().toISOString() },
    });
    if (result.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent, data });
}
