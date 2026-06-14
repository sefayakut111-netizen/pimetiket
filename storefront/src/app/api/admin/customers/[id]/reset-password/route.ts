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
 *   2. admin.auth.admin.generateLink({ type: 'recovery', email })
 *   3. enqueueMail (_prerendered + daily idempotency)
 *   4. audit_log: customer.reset_password (link ASLA detail'a yazılmaz)
 */

import { NextResponse, type NextRequest } from "next/server";
import { render } from "@react-email/render";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import { enqueueMail } from "@/lib/mail/enqueue";
import { PasswordResetEmail } from "@/lib/mail/templates/password-reset";

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
  const auth = await assertPermission("customers", "update");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: userData, error: userErr } =
    await admin.auth.admin.getUserById(id);
  if (userErr || !userData?.user?.email) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 }
    );
  }
  const email = userData.user.email;

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

  const today = new Date().toISOString().slice(0, 10);
  const subject = "Pim Etiket — Şifre sıfırlama";
  const html = await render(
    PasswordResetEmail({
      recipientEmail: email,
      resetLink,
    })
  );
  const text = `Şifre sıfırlama — ${email}. Link maildeki butonda.`;

  const result = await enqueueMail({
    templateKey: "_prerendered",
    to: email,
    category: "customer",
    targetType: "user",
    targetId: id,
    subject,
    payload: {
      subject,
      html,
      text,
      _kind: "password_reset",
      _user_id: id,
    },
    idempotencyKey: `password_reset:${id}:${today}`,
  });

  if (result.suppressed) {
    return NextResponse.json({ ok: true, suppressed: true, sent_to: email });
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "enqueue_failed", detail: result.error },
      { status: 500 }
    );
  }

  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "customer.reset_password" as Enums<"audit_action">,
        target_type: "user",
        target_id: id,
        summary: `Şifre sıfırlama maili kuyruğa eklendi → ${email}`,
        detail: { email },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true, sent_to: email });
}
