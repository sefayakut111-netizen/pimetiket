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
 *   2. enqueueMail (_prerendered + suppression/idempotency)
 *   3. Cron /api/cron/process-mail-outbox 5dk içinde Resend ile yollar
 *   4. audit_log: customer.email_sent
 */

import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { render } from "@react-email/render";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import { enqueueMail } from "@/lib/mail/enqueue";
import { AdminCustomMessageEmail } from "@/lib/mail/templates/admin-custom-message";

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

  const { data: userData, error: userErr } =
    await admin.auth.admin.getUserById(id);
  if (userErr || !userData?.user?.email) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 }
    );
  }
  const toEmail = userData.user.email;
  const recipientName =
    typeof userData.user.user_metadata?.full_name === "string"
      ? userData.user.user_metadata.full_name
      : undefined;
  const senderEmail = auth.user.email ?? undefined;

  const hash = createHash("sha256")
    .update(`${subject}${body_text}`)
    .digest("hex")
    .slice(0, 16);

  const html = await render(
    AdminCustomMessageEmail({
      recipientName,
      subject,
      bodyText: body_text,
      senderEmail,
    })
  );

  const result = await enqueueMail({
    templateKey: "_prerendered",
    to: toEmail,
    category: "customer",
    targetType: "user",
    targetId: id,
    subject,
    payload: {
      subject,
      html,
      text: body_text,
      _kind: "admin_custom",
      _user_id: id,
    },
    idempotencyKey: `admin_custom:${id}:${hash}`,
  });

  if (result.suppressed) {
    return NextResponse.json({ ok: true, suppressed: true });
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
        action: "customer.email_sent" as Enums<"audit_action">,
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
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}
