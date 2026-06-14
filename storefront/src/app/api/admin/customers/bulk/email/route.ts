/**
 * POST /api/admin/customers/bulk/email
 *
 * Birden fazla müşteriye toplu email gönder.
 *
 * Body: { user_ids: string[], subject: string, body_text: string }
 *
 * enqueueMail + suppression/idempotency — cron process-mail-outbox gönderir.
 * Limit: max 100 alıcı / istek (spam koruması).
 */

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { enqueueMail } from "@/lib/mail/enqueue";
import { AdminCustomMessageEmail } from "@/lib/mail/templates/admin-custom-message";

export async function POST(req: Request) {
  const auth = await assertPermission("customers", "update");
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
  const senderEmail = auth.user.email ?? "info@pimetiket.com";
  const hash = createHash("sha256")
    .update(`${subject}${text}`)
    .digest("hex")
    .slice(0, 16);

  const enqueued: string[] = [];
  const skipped: string[] = [];
  const suppressed: string[] = [];

  for (const userId of userIds) {
    const { data: user } = await admin.auth.admin.getUserById(userId);
    if (!user?.user?.email) {
      skipped.push(userId);
      continue;
    }

    const recipientName =
      typeof user.user.user_metadata?.full_name === "string"
        ? user.user.user_metadata.full_name
        : undefined;

    const html = await render(
      AdminCustomMessageEmail({
        recipientName,
        subject,
        bodyText: text,
        senderEmail,
      })
    );

    const result = await enqueueMail({
      templateKey: "_prerendered",
      to: user.user.email,
      category: "customer",
      targetType: "user",
      targetId: userId,
      subject,
      payload: {
        subject,
        html,
        text,
        _kind: "admin_custom_bulk",
        _user_id: userId,
      },
      idempotencyKey: `admin_custom_bulk:${userId}:${hash}`,
    });

    if (result.suppressed) {
      suppressed.push(userId);
      continue;
    }
    if (!result.ok) {
      skipped.push(userId);
      continue;
    }
    enqueued.push(userId);
  }

  if (enqueued.length > 0) {
    const notes = enqueued.map((uid) => ({
      user_id: uid,
      author_id: auth.user.id,
      author_name: auth.user.email ?? "admin",
      body: `📧 Toplu email gönderildi (${enqueued.length} alıcı) — "${subject}"`,
      pinned: false,
    }));
    await admin.from("customer_notes").insert(notes);
  }

  return NextResponse.json({
    ok: true,
    enqueued: enqueued.length,
    skipped: skipped.length,
    suppressed: suppressed.length,
    total_requested: userIds.length,
  });
}
