/**
 * GET /api/cron/request-reviews
 *
 * Teslim edilen siparişler için yorum talebi maili.
 *
 * Tetik kriterleri:
 *   - orders.status = 'delivered'
 *   - 7-21 gün önce teslim edilmiş (üst sınır spam'i önler)
 *   - O sipariş için son 30 günde review request maili gönderilmedi
 *   - Müşteri henüz yorum yazmamış (reviews tablosunda kayıt yok)
 *
 * Vercel Cron daily.
 *
 * Auth: CRON_SECRET Bearer header.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { sendReviewRequest } from "@/lib/mail/notifications";

export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("request-reviews", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

  // 7-21 gün önce teslim edilen siparişler
  // delivered_at kolonu yoksa updated_at + status='delivered' kullanılır
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const twentyOneDaysAgo = new Date(
    Date.now() - 21 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: orders, error } = await admin
    .from("orders")
    .select("id, user_id, address, updated_at")
    .eq("status", "delivered")
    .lte("updated_at", sevenDaysAgo)
    .gte("updated_at", twentyOneDaysAgo)
    .limit(BATCH_LIMIT);

      if (error) {
        console.error("[request-reviews] query error:", error);
        throw new Error(error.message);
      }

  type OrderRow = {
    id: string;
    user_id: string | null;
    address: { name?: string } | null;
    updated_at: string;
  };

  const list = (orders ?? []) as OrderRow[];
      if (list.length === 0) {
        return {
          summary: "Review request adayı yok",
          itemsProcessed: 0,
          data: {
            ok: true,
            candidates: 0,
            enqueued: 0,
            skipped: { already_reviewed: 0, already_mailed: 0, no_email: 0 },
          },
        };
      }

  const orderIds = list.map((o) => o.id);

  // Bu order'lar için review var mı?
  const { data: existingReviews } = await admin
    .from("reviews")
    .select("order_id")
    .in("order_id", orderIds);
  const reviewedOrderIds = new Set(
    ((existingReviews ?? []) as Array<{ order_id: string }>).map(
      (r) => r.order_id
    )
  );

  // Son 30 günde review_request maili gönderildi mi?
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: recentMails } = await admin
    .from("fason_mail_outbox")
    .select("idempotency_key")
    .like("idempotency_key", "review_request:%")
    .in("target_id", orderIds)
    .gte("created_at", thirtyDaysAgo);
  const mailedOrderIds = new Set(
    ((recentMails ?? []) as Array<{ idempotency_key: string | null }>)
      .map((m) => m.idempotency_key?.replace(/^review_request:/, ""))
      .filter((id): id is string => !!id)
  );

  const stats = {
    already_reviewed: 0,
    already_mailed: 0,
    no_email: 0,
  };

  let enqueued = 0;

  for (const o of list) {
    if (reviewedOrderIds.has(o.id)) {
      stats.already_reviewed += 1;
      continue;
    }
    if (mailedOrderIds.has(o.id)) {
      stats.already_mailed += 1;
      continue;
    }

    // Email
    if (!o.user_id) {
      stats.no_email += 1;
      continue;
    }
    const { data: userData } = await admin.auth.admin.getUserById(o.user_id);
    const email = userData?.user?.email;
    if (!email) {
      stats.no_email += 1;
      continue;
    }

    const result = await sendReviewRequest({
      userId: o.user_id,
      orderId: o.id,
      productName: "siparişin",
    });

    if (result.ok) enqueued += 1;
    else if (result.reason === "opted_out") {
      /* marketing opt-out — sessiz atla */
    }
  }

      const responseData = {
        ok: true,
        candidates: list.length,
        enqueued,
        skipped: stats,
        timestamp: new Date().toISOString(),
      };

      return {
        summary: `${enqueued} review request maili kuyruğa alındı`,
        itemsProcessed: enqueued,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/request-reviews]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
