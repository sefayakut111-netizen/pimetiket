/**
 * GET /api/admin/mail-health
 *
 * Sefa 21 May v68 — Mail observability dashboard verisi.
 *
 * Çıktı:
 *   {
 *     ok: true,
 *     window: "24h",
 *     resend: { configured, webhook_configured, from_address },
 *     stats24h: {
 *       enqueued, sent, delivered, bounced, complaint,
 *       failed, pending, opened, clicked
 *     },
 *     ratesPct: { deliveryRate, bounceRate, complaintRate, openRate, clickRate },
 *     byCategory: [ { category, count, sent, failed, delivered } ],
 *     suppressionsCount: { bounce_hard, complaint, unsubscribe_marketing, ... },
 *     suppressions: [ { email, type, reason, created_at }, ... ] (last 100)
 *     failedRecent: [ { id, template_key, to_email, last_error, attempts, ... } ] (last 20)
 *   }
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OutboxStatRow {
  status: string | null;
  category: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complaint_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ─── 1) Outbox son 24sa ───
  const { data: outboxData, error: outboxErr } = await admin
    .from("fason_mail_outbox")
    .select(
      "status, category, delivered_at, bounced_at, complaint_at, opened_at, clicked_at"
    )
    .gte("created_at", dayAgo)
    .limit(5000);

  if (outboxErr) {
    return NextResponse.json(
      {
        ok: false,
        error: outboxErr.message,
        code: outboxErr.code,
        fix:
          outboxErr.code === "42703"
            ? "Migration 076 uygula — observability kolonları eksik"
            : undefined,
      },
      { status: 500 }
    );
  }

  const rows = (outboxData ?? []) as OutboxStatRow[];

  const stats24h = {
    enqueued: rows.length,
    sent: rows.filter((r) => r.status === "sent").length,
    delivered: rows.filter((r) => Boolean(r.delivered_at)).length,
    bounced: rows.filter((r) => Boolean(r.bounced_at)).length,
    complaint: rows.filter((r) => Boolean(r.complaint_at)).length,
    opened: rows.filter((r) => Boolean(r.opened_at)).length,
    clicked: rows.filter((r) => Boolean(r.clicked_at)).length,
    failed: rows.filter((r) => r.status === "failed").length,
    pending: rows.filter(
      (r) => r.status === "pending" || r.status === "sending"
    ).length,
  };

  const pct = (n: number, d: number): number =>
    d > 0 ? Math.round((n / d) * 1000) / 10 : 0;

  const ratesPct = {
    // Resend "sent" = API'ye iletilmiş → delivered = mailbox'a düşmüş
    deliveryRate: pct(stats24h.delivered, stats24h.sent),
    bounceRate: pct(stats24h.bounced, stats24h.sent),
    complaintRate: pct(stats24h.complaint, stats24h.sent),
    openRate: pct(stats24h.opened, stats24h.delivered),
    clickRate: pct(stats24h.clicked, stats24h.delivered),
  };

  // ─── 2) Kategori bazlı kırılım ───
  const catMap = new Map<
    string,
    {
      category: string;
      count: number;
      sent: number;
      failed: number;
      delivered: number;
    }
  >();
  for (const r of rows) {
    const c = r.category ?? "unknown";
    const entry = catMap.get(c) ?? {
      category: c,
      count: 0,
      sent: 0,
      failed: 0,
      delivered: 0,
    };
    entry.count++;
    if (r.status === "sent") entry.sent++;
    if (r.status === "failed") entry.failed++;
    if (r.delivered_at) entry.delivered++;
    catMap.set(c, entry);
  }
  const byCategory = Array.from(catMap.values()).sort(
    (a, b) => b.count - a.count
  );

  // ─── 3) Suppression özeti ───
  const { data: suppData, error: suppErr } = await admin
    .from("mail_suppressions")
    .select("id, email, suppression_type, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const suppressions = suppErr
    ? []
    : (suppData ?? []).map((s: Record<string, unknown>) => ({
        id: String(s.id ?? ""),
        email: String(s.email ?? ""),
        type: String(s.suppression_type ?? ""),
        reason: s.reason ? String(s.reason) : null,
        created_at: String(s.created_at ?? ""),
      }));

  // Tip bazlı sayım
  const suppressionsCount: Record<string, number> = {};
  for (const s of suppressions) {
    suppressionsCount[s.type] = (suppressionsCount[s.type] ?? 0) + 1;
  }

  // ─── 4) Failed mailler (son 20) ───
  const { data: failedData } = await admin
    .from("fason_mail_outbox")
    .select(
      "id, template_key, to_email, last_error, attempts, next_retry_at, created_at, category"
    )
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(20);

  const failedRecent = (failedData ?? []).map(
    (f: Record<string, unknown>) => ({
      id: String(f.id ?? ""),
      template_key: String(f.template_key ?? ""),
      to_email: String(f.to_email ?? ""),
      last_error: f.last_error ? String(f.last_error) : null,
      attempts: Number(f.attempts ?? 0),
      next_retry_at: f.next_retry_at ? String(f.next_retry_at) : null,
      created_at: String(f.created_at ?? ""),
      category: f.category ? String(f.category) : null,
    })
  );

  return NextResponse.json({
    ok: true,
    window: "24h",
    resend: {
      configured: Boolean(process.env.RESEND_API_KEY),
      webhook_configured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
      unsubscribe_configured: Boolean(
        process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET
      ),
      from_address:
        process.env.RESEND_FROM_EMAIL ?? process.env.MAIL_FROM_ADDRESS ?? null,
    },
    stats24h,
    ratesPct,
    byCategory,
    suppressionsCount,
    suppressions,
    failedRecent,
    timestamp: new Date().toISOString(),
  });
}
