/**
 * GET /api/cron/detect-abandoned-carts
 *
 * Vercel Cron günde 1 (Hobby plan limit) bu endpoint'i çağırır.
 * Tetik kriterleri:
 *   - cart_items.added_at 24h-72h aralığında (çok eski sepet rahatsız etmez)
 *   - O kullanıcı bu pencerede HİÇ sipariş açmamış
 *   - Son 7 günde abandoned_cart maili gönderilmemiş
 *
 * Aksiyon:
 *   - lib/mail/enqueue → customer_abandoned_cart template'i
 *   - Resend env yokken outbox'ta bekler, env varsa mail gider
 *
 * Auth: CRON_SECRET Bearer header (Vercel Cron otomatik gönderir).
 *
 * Anonim/guest carts: HARİÇ — localStorage'da, server bilmiyor.
 * Sadece login user'lı carts.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { sendAbandonedCart } from "@/lib/mail/notifications";

export const dynamic = "force-dynamic";

interface CartUserSummary {
  user_id: string;
  email: string;
  full_name: string | null;
  item_count: number;
  cart_total: number;
}

const MIN_TOTAL_TL = 100; // Çok küçük cart'a mail atma — spam algılanır
const BATCH_LIMIT = 100;

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("detect-abandoned-carts", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

  // 24-72 saat aralığında cart'ı olan user_id'ler
  const cutoffOld = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cutoffYoungest = new Date(
    Date.now() - 72 * 60 * 60 * 1000
  ).toISOString();

  const { data: cartRows, error: cartErr } = await admin
    .from("cart_items")
    .select("user_id, total, added_at")
    .lte("added_at", cutoffOld)
    .gte("added_at", cutoffYoungest)
    .limit(1000);

      if (cartErr) {
        console.error("[abandoned-carts] cart query error:", cartErr);
        throw new Error(cartErr.message);
      }

  type CartRow = { user_id: string; total: number; added_at: string };
  const carts = (cartRows ?? []) as CartRow[];

  // user_id bazlı agregasyon
  const byUser = new Map<
    string,
    { count: number; total: number; oldestAt: string }
  >();
  for (const c of carts) {
    const ex = byUser.get(c.user_id);
    if (ex) {
      ex.count += 1;
      ex.total += Number(c.total);
      if (c.added_at < ex.oldestAt) ex.oldestAt = c.added_at;
    } else {
      byUser.set(c.user_id, {
        count: 1,
        total: Number(c.total),
        oldestAt: c.added_at,
      });
    }
  }

      if (byUser.size === 0) {
        return {
          summary: "Abandoned cart adayı yok",
          itemsProcessed: 0,
          data: {
            ok: true,
            candidates: 0,
            enqueued: 0,
            skipped: { recent_order: 0, low_total: 0, already_mailed: 0, no_email: 0 },
          },
        };
      }

  const candidates = Array.from(byUser.entries()).slice(0, BATCH_LIMIT);
  const userIds = candidates.map(([id]) => id);

  // Bu user'lar son 72 saatte sipariş açtı mı? (açtıysa cart artık abandoned değil)
  const { data: recentOrders } = await admin
    .from("orders")
    .select("user_id")
    .in("user_id", userIds)
    .gte("created_at", cutoffYoungest);

  const usersWithOrders = new Set(
    ((recentOrders ?? []) as Array<{ user_id: string }>).map((o) => o.user_id)
  );

  // Bu user'lara son 7 günde abandoned_cart maili gönderildi mi?
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  // #4 — notifications.ts sendAbandonedCart ile LOCKSTEP: hafta-kovalı key (penceresiz
  // fn_enqueue_mail idempotency'sinde ömür-boyu suppression önlenir). .gte(sevenDaysAgo)
  // defense-in-depth olarak kalır.
  const weekKey = Math.floor(Date.now() / (7 * 86400000));
  const idempotencyKeys = userIds.map((uid) => `abandoned_cart:${uid}:${weekKey}`);
  const { data: recentMails } = await admin
    .from("fason_mail_outbox")
    .select("idempotency_key")
    .in("idempotency_key", idempotencyKeys)
    .gte("created_at", sevenDaysAgo);

  const usersWithMail = new Set(
    ((recentMails ?? []) as Array<{ idempotency_key: string | null }>)
      .map((m) => {
        const key = m.idempotency_key ?? "";
        const parts = key.split(":");
        return parts.length >= 3 ? parts[1] : null;
      })
      .filter((id): id is string => !!id)
  );

  // Email ve isim için profiles + auth.users
  const summaries: CartUserSummary[] = [];
  const stats = {
    recent_order: 0,
    low_total: 0,
    already_mailed: 0,
    no_email: 0,
  };

  for (const [userId, agg] of candidates) {
    if (usersWithOrders.has(userId)) {
      stats.recent_order += 1;
      continue;
    }
    if (usersWithMail.has(userId)) {
      stats.already_mailed += 1;
      continue;
    }
    if (agg.total < MIN_TOTAL_TL) {
      stats.low_total += 1;
      continue;
    }

    // Email + isim al
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) {
      stats.no_email += 1;
      continue;
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    summaries.push({
      user_id: userId,
      email,
      full_name: (profile as { full_name?: string } | null)?.full_name ?? null,
      item_count: agg.count,
      cart_total: agg.total,
    });
  }

  // Kuyruğa enqueue
  let enqueued = 0;
  for (const s of summaries) {
    const result = await sendAbandonedCart({
      userId: s.user_id,
      itemCount: s.item_count,
      total: s.cart_total,
      customerName: s.full_name?.split(" ")[0] ?? "",
    });
    if (result.ok) enqueued += 1;
  }

      const responseData = {
        ok: true,
        candidates: byUser.size,
        enqueued,
        skipped: stats,
        timestamp: new Date().toISOString(),
      };

      return {
        summary: `${enqueued} abandoned cart maili kuyruğa alındı`,
        itemsProcessed: enqueued,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/detect-abandoned-carts]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
