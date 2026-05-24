/**
 * /api/admin/customers/[id]/send-email
 *
 * Admin operatör tek tıkla müşteriye custom mail tetikler. Sefa 23
 * May v68 (P0 #4 — Grup D). Bu dosya daha önce CSV export
 * handler'ının kopyasıydı; UI "mail gönder" butonu CSV indiriyordu.
 *
 * UI sözleşmesi (src/app/admin/musteriler/[id]/page.tsx):
 *   POST { subject: string, body_text: string } → { ok, error? }
 *
 * Akış:
 *   1. auth.users'tan müşteri email'i çek (yoksa 404)
 *   2. fason_mail_outbox INSERT (assignment_id NULL, template_key
 *      "admin_custom", category "customer", target_type "user")
 *   3. Cron /api/cron/process-mail-outbox 5dk içinde Resend ile yollar
 *   4. audit_log: customer.email_sent
 *
 * Şema referansı:
 *   - Mig 035: assignment_id NULL'a izin verildi + category +
 *     target_type/target_id (polymorphic).
 *   - Mig 037: target_id uuid → text (orders.id PE-2026-XXXX yüzünden).
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  subject: z.string().trim().min(1, "Konu boş olamaz").max(200),
  body_text: z.string().trim().min(1, "Mesaj boş olamaz").max(10000),
});

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
function userAgent(req: Request): string | null {
  return req.headers.get("user-agent") ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "update");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const parsed = PostBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: parsed.error.message },
      { status: 400 }
    );
  }
  const { subject, body_text } = parsed.data;

  const admin = createAdminClient();

  // 1) Müşteri email'i (auth.users)
  const { data: userData, error: userErr } =
    await admin.auth.admin.getUserById(id);
  if (userErr || !userData?.user?.email) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 }
    );
  }
  const toEmail = userData.user.email;

  // 2) Outbox INSERT
  const { error: outboxErr } = await admin.from("fason_mail_outbox").insert([
    {
      assignment_id: null,
      template_key: "admin_custom",
      to_email: toEmail,
      subject,
      payload: {
        body_text,
        sender_email: auth.user.email ?? null,
      },
      category: "customer",
      target_type: "user",
      target_id: id,
      status: "pending",
      attempts: 0,
    },
  ] as never);

  if (outboxErr) {
    return NextResponse.json(
      { error: "enqueue_failed", detail: outboxErr.message },
      { status: 500 }
    );
  }

  // 3) Audit
  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "customer.email_sent",
        target_type: "user",
        target_id: id,
        summary: `Custom mail kuyruğa eklendi → ${toEmail}: ${subject}`,
        detail: {
          subject,
          to_email: toEmail,
          body_length: body_text.length,
        },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ] as never);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}
