/**
 * POST /api/admin/customers/[id]/send-email
 *
 * Müşteriye admin'in manuel email göndermesi (Resend ile direkt).
 *
 * Body: { subject: string, body_text: string, template?: 'plain'|'announcement' }
 *
 * Limit: subject 2-120, body 10-4000 char.
 * Logging: fason_mail_outbox'a kayıt + customer_notes auto-log
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    body_text?: string;
  };
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

  // Kullanıcının emailini al
  const { data: user, error: userErr } = await admin.auth.admin.getUserById(id);
  if (userErr || !user?.user?.email) {
    return NextResponse.json(
      { error: "user_email_missing" },
      { status: 404 }
    );
  }
  const toEmail = user.user.email;

  // mail_outbox'a ekle — cron process-mail-outbox Resend ile gönderir
  const { data: outbox, error: outboxErr } = await admin
    .from("fason_mail_outbox")
    .insert([
      {
        assignment_id: null,
        template_key: "admin_custom",
        to_email: toEmail.toLowerCase(),
        subject,
        payload: {
          body_text: text,
          sender_email: auth.user.email ?? "info@pimetiket.com",
        },
        category: "customer",
        target_type: "user",
        target_id: id,
        status: "pending",
        attempts: 0,
      },
    ] as never)
    .select("id")
    .single();

  if (outboxErr) {
    return NextResponse.json(
      { error: "outbox_failed", detail: outboxErr.message },
      { status: 500 }
    );
  }

  // Customer_notes'a auto-log
  await admin.from("customer_notes").insert([
    {
      user_id: id,
      author_id: auth.user.id,
      author_name: auth.user.email ?? "admin",
      body: `📧 Email gönderildi — "${subject}"\n\n${text.slice(0, 500)}${text.length > 500 ? "…" : ""}`,
      pinned: false,
    },
  ] as never);

  return NextResponse.json({
    ok: true,
    outbox_id: (outbox as { id: string } | null)?.id,
    to: toEmail,
  });
}
