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
import { withCronRun } from "@/lib/cron-logger";
import { ACTIVE_ASSIGNMENT_STATUS_LIST } from "@/lib/fason/active-assignment-statuses";
import { sendAdminDailySummary } from "@/lib/mail/notifications";

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
  fasonOverdueCount: number; // estimated_delivery geçmiş aktif atama
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

  try {
    const payload = await withCronRun("admin-daily-summary", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
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

  // 5) Partner kapasite uyarısı (%85+) — fason_partners + ACTIVE_ASSIGNMENT_STATUS_LIST
  type PartnerRow = {
    id: string;
    name: string;
    max_concurrent_orders: number | null;
  };
  const { data: partnersData } = await admin
    .from("fason_partners")
    .select("id, name, max_concurrent_orders")
    .eq("active", true);
  const partners = (partnersData ?? []) as PartnerRow[];

  const { data: activeAssignments } = await admin
    .from("order_assignments")
    .select("fason_partner_id")
    .in("status", [...ACTIVE_ASSIGNMENT_STATUS_LIST]);

  const activeCountByPartner = new Map<string, number>();
  for (const row of (activeAssignments ?? []) as Array<{
    fason_partner_id: string;
  }>) {
    activeCountByPartner.set(
      row.fason_partner_id,
      (activeCountByPartner.get(row.fason_partner_id) ?? 0) + 1
    );
  }

  let partnerCapacityWarn = 0;
  for (const p of partners) {
    if (!p.max_concurrent_orders || p.max_concurrent_orders <= 0) continue;
    const active = activeCountByPartner.get(p.id) ?? 0;
    if (active >= p.max_concurrent_orders * 0.85) {
      partnerCapacityWarn++;
    }
  }

  const nowIso = new Date().toISOString();
  const { count: fasonOverdueCount } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .in("status", [...ACTIVE_ASSIGNMENT_STATUS_LIST])
    .not("estimated_delivery", "is", null)
    .lt("estimated_delivery", nowIso);

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
    fasonOverdueCount: fasonOverdueCount ?? 0,
  };

  const mailResult = await sendAdminDailySummary(data);
  const sent = mailResult.sent;

      const responseData = { ok: true, sent, data };

      return {
        summary: `Admin özeti ${sent}/${adminEmails.length} alıcıya kuyruğa alındı`,
        itemsProcessed: sent,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/admin-daily-summary]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
