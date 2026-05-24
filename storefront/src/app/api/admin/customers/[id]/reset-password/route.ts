/**
 * /api/admin/customers/[id]/reset-password
 *
 * Admin tetiklemeli şifre sıfırlama maili. Sefa 23 May v68
 * (P0 #4 — Grup D). Bu dosya daha önce CSV export handler'ının
 * kopyasıydı; UI "şifre sıfırla" butonu CSV indiriyordu.
 *
 * UI sözleşmesi (src/app/admin/musteriler/[id]/page.tsx):
 *   POST (body yok) → { ok, sent_to, error? }
 *
 * Akış:
 *   1. auth.users'tan müşteri email'i çek (yoksa 404)
 *   2. admin.auth.admin.generateLink({ type: 'recovery', email }) ile
 *      reset linki üret (GoTrue hash'li token).
 *   3. fason_mail_outbox INSERT (template_key "password_reset",
 *      category "customer", target_type "user")
 *   4. Cron /api/cron/process-mail-outbox 5dk içinde Resend ile yollar
 *   5. audit_log: customer.reset_password (link ASLA detail'a yazılmaz)
 *
 * Güvenlik notu: action_link içinde tek-kullanımlık recovery token
 * var. audit_log'da yalnızca email loglanır, link payload'a (outbox)
 * gider — outbox SELECT politikası admin-only (Mig 020:188).
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  // 1) Müşteri email'i
  const { data: userData, error: userErr } =
    await admin.auth.admin.getUserById(id);
  if (userErr || !userData?.user?.email) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 }
    );
  }
  const email = userData.user.email;

  // 2) Reset link üret
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      {
        error: "generate_link_failed",
        detail: linkErr?.message ?? "no_action_link",
      },
      { status: 500 }
    );
  }
  const resetLink = linkData.properties.action_link;

  // 3) Outbox INSERT — Resend cron 5dk içinde yollar
  const { error: outboxErr } = await admin.from("fason_mail_outbox").insert([
    {
      assignment_id: null,
      template_key: "password_reset",
      to_email: email,
      subject: "Pim Etiket — Şifre sıfırlama",
      payload: {
        reset_link: resetLink,
        user_email: email,
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

  // 4) Audit — link KAYDEDİLMEZ
  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "customer.reset_password",
        target_type: "user",
        target_id: id,
        summary: `Şifre sıfırlama maili kuyruğa eklendi → ${email}`,
        detail: { email },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ] as never);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true, sent_to: email });
}
