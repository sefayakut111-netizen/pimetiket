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
import { enqueueMail } from "@/lib/mail/enqueue";

export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;

export async function GET(req: Request) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type OrderRow = {
    id: string;
    user_id: string | null;
    address: { name?: string } | null;
    updated_at: string;
  };

  const list = (orders ?? []) as OrderRow[];
  if (list.length === 0) {
    return NextResponse.json({
      ok: true,
      candidates: 0,
      enqueued: 0,
      skipped: { already_reviewed: 0, already_mailed: 0, no_email: 0 },
    });
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
    .select("target_id")
    .eq("template_key", "customer_review_request")
    .in("target_id", orderIds)
    .gte("created_at", thirtyDaysAgo);
  const mailedOrderIds = new Set(
    ((recentMails ?? []) as Array<{ target_id: string | null }>)
      .map((m) => m.target_id)
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

    const customerName =
      typeof o.address?.name === "string"
        ? o.address.name.split(" ")[0]
        : "";

    // Review token — login olmadan yorum yazabilmek için (gelecek özelliği,
    // şu an /siparislerim üzerinden yönlendirilir)
    const reviewToken = "";

    const result = await enqueueMail({
      templateKey: "customer_review_request",
      to: email,
      payload: {
        order_id: o.id,
        customer_name: customerName,
        product_name: "siparişin",
        review_token: reviewToken,
      },
      category: "customer",
      targetType: "order",
      targetId: o.id,
    });

    if (result.ok) enqueued += 1;
  }

  return NextResponse.json({
    ok: true,
    candidates: list.length,
    enqueued,
    skipped: stats,
    timestamp: new Date().toISOString(),
  });
}
