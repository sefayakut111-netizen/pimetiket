/**
 * GET /api/cron/upload-reminders
 *
 * Sefa 19 May v68 (Migration 061 — awaiting_upload):
 * awaiting_upload statüsünde 24h+ kalan siparişlere "tasarım yükle"
 * hatırlatması atar. Vercel Cron günde 1 (Hobby limit) tetikler.
 *
 * Kriter:
 *   - orders.status = 'awaiting_upload'
 *   - paid_at 24h-14gün arası (çok eskileri otomatik iptal cron'u temizler)
 *   - Son 24sa içinde reminder mail gönderilmemiş (mail_outbox kontrolü)
 *
 * Aksiyon:
 *   - lib/mail/enqueue → order-upload-reminder template
 *   - Resend env yoksa outbox'ta bekler (Sefa pattern)
 *
 * Auth: CRON_SECRET Bearer header (Vercel Cron otomatik).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { enqueueMail } from "@/lib/mail/enqueue";

export const dynamic = "force-dynamic";

const MAX_AGE_HOURS = 14 * 24; // 14 gün — sonrasında otomatik iptal/iade
const MIN_AGE_HOURS = 24; // 24 saat içinde rahatsız etme
const BATCH_LIMIT = 100;

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun<Record<string, unknown>>("upload-reminders", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

  const nowMs = Date.now();
  const minAge = new Date(nowMs - MIN_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const maxAge = new Date(nowMs - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

  // awaiting_upload + 24sa-14gün arası ödenmiş
  const { data: orders, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, paid_at, created_at")
    .eq("status", "awaiting_upload")
    .lte("paid_at", minAge)
    .gte("paid_at", maxAge)
    .order("paid_at", { ascending: true })
    .limit(BATCH_LIMIT);

      if (orderErr) {
        console.error("[upload-reminders] order query error:", orderErr);
        throw new Error(orderErr.message);
      }

  type OrderRow = {
    id: string;
    user_id: string;
    paid_at: string | null;
    created_at: string;
  };
  const orderRows = (orders ?? []) as OrderRow[];
      if (orderRows.length === 0) {
        return {
          summary: "Awaiting upload sipariş yok",
          itemsProcessed: 0,
          data: { ok: true, sent: 0, reason: "no_awaiting" },
        };
      }

  // user info — name + email
  const userIds = Array.from(new Set(orderRows.map((o) => o.user_id)));
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  const profileMap = new Map(
    (
      (profiles as Array<{ id: string; email: string; full_name: string | null }>) ??
      []
    ).map((p) => [p.id, p])
  );

  // Son 24sa içinde reminder gönderilen order_id'ler — duplicate engelle.
  // Mig 020/035/037: tablo adı fason_mail_outbox (legacy ad; polymorphic).
  const recentCutoff = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentMails } = await admin
    .from("fason_mail_outbox")
    .select("target_id")
    .eq("template_key", "order_upload_reminder")
    .gte("created_at", recentCutoff)
    .in(
      "target_id",
      orderRows.map((o) => o.id)
    );
  const recentMailed = new Set(
    ((recentMails as Array<{ target_id: string }>) ?? []).map((m) => m.target_id)
  );

  let sent = 0;
  let skipped = 0;
  for (const order of orderRows) {
    if (recentMailed.has(order.id)) {
      skipped++;
      continue;
    }
    const profile = profileMap.get(order.user_id);
    if (!profile?.email) {
      skipped++;
      continue;
    }

    // Item sayısı — kaç tasarım bekliyor (order_items.count)
    const { count: itemCount } = await admin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);

    const hoursSincePaid = order.paid_at
      ? Math.floor((nowMs - new Date(order.paid_at).getTime()) / 3_600_000)
      : 24;

    try {
      await enqueueMail({
        templateKey: "order_upload_reminder",
        to: profile.email,
        payload: {
          customerName: profile.full_name || "değerli müşterimiz",
          orderId: order.id,
          pendingCount: itemCount ?? 1,
          hoursSincePaid,
        },
        category: "customer",
        targetType: "order",
        targetId: order.id,
        subject: `Tasarımını bekliyoruz — Sipariş ${order.id}`,
      });
      sent++;
    } catch (err) {
      console.error("[upload-reminders] enqueue failed:", order.id, err);
      skipped++;
    }
  }

      const responseData = { ok: true, sent, skipped, total: orderRows.length };

      return {
        summary: `${sent} upload reminder gönderildi, ${skipped} atlandı`,
        itemsProcessed: sent,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/upload-reminders]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
