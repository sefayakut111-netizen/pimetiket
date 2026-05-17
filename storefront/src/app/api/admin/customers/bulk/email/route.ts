/**
 * POST /api/admin/customers/bulk/email
 *
 * Birden fazla müşteriye toplu email gönder.
 *
 * Body: { user_ids: string[], subject: string, body_text: string }
 *
 * Her kullanıcı için fason_mail_outbox'a ayrı kayıt — cron process-mail-outbox
 * Resend ile sırayla gönderir. Bu sayede:
 *   - Retry desteği (her kayıt bağımsız)
 *   - Rate limiting (Resend günlük limit)
 *   - Audit trail (her gönderim log'lanır)
 *
 * Limit: max 100 alıcı / istek (spam koruması).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    user_ids?: string[];
    subject?: string;
    body_text?: string;
  };

  const userIds = Array.isArray(body.user_ids) ? body.user_ids : [];
  if (userIds.length === 0) {
    return NextResponse.json({ error: "no_recipients" }, { status: 400 });
  }
  if (userIds.length > 100) {
    return NextResponse.json(
      { error: "too_many", hint: "Maksimum 100 alıcı / istek" },
      { status: 400 }
    );
  }

  const subject = (body.subject ?? "").trim();
  const text = (body.body_text ?? "").trim();
  if (subject.length < 2 || subject.length > 120) {
    return NextResponse.json(
      { error: "invalid_subject", hint: "2-120 karakter" },
      { status: 400 }
    );
  }
  if (text.length < 10 || text.length > 4000) {
    return NextResponse.json(
      { error: "invalid_body", hint: "10-4000 karakter" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Tüm kullanıcıların emaillerini topla (admin API)
  const enqueued: string[] = [];
  const skipped: string[] = [];

  for (const userId of userIds) {
    const { data: user } = await admin.auth.admin.getUserById(userId);
    if (!user?.user?.email) {
      skipped.push(userId);
      continue;
    }
    const { error: outboxErr } = await admin
      .from("fason_mail_outbox")
      .insert([
        {
          assignment_id: null,
          template_key: "admin_custom",
          to_email: user.user.email.toLowerCase(),
          subject,
          payload: {
            body_text: text,
            sender_email: auth.user.email ?? "info@pimetiket.com",
          },
          category: "customer",
          target_type: "user",
          target_id: userId,
          status: "pending",
          attempts: 0,
        },
      ] as never);
    if (outboxErr) {
      skipped.push(userId);
      continue;
    }
    enqueued.push(userId);
  }

  // Customer notes auto-log her enqueued user için
  if (enqueued.length > 0) {
    const notes = enqueued.map((uid) => ({
      user_id: uid,
      author_id: auth.user.id,
      author_name: auth.user.email ?? "admin",
      body: `📧 Toplu email gönderildi (${enqueued.length} alıcı) — "${subject}"`,
      pinned: false,
    }));
    await admin.from("customer_notes").insert(notes as never);
  }

  return NextResponse.json({
    ok: true,
    enqueued: enqueued.length,
    skipped: skipped.length,
    total_requested: userIds.length,
  });
}
