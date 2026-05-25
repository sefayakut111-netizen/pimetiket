/**
 * GET /api/admin/mail-templates — şablon listesi + önizleme
 * POST — test mail gönder (admin email veya recipientEmail)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { getDefaultFrom, sendMail } from "@/lib/mail/resend";
import {
  MAIL_TEMPLATES,
  isMailTemplateKey,
  previewMailTemplate,
} from "@/lib/mail/template-registry";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await assertPermission("mail_health", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const preview = url.searchParams.get("preview") === "true";

  if (!key) {
    return NextResponse.json({
      ok: true,
      templates: MAIL_TEMPLATES.map((t) => ({
        key: t.key,
        label: t.label,
        subject: t.subject,
      })),
      from: getDefaultFrom(),
    });
  }

  if (!isMailTemplateKey(key)) {
    return NextResponse.json({ ok: false, error: "Geçersiz şablon" }, { status: 400 });
  }

  if (!preview) {
    const meta = MAIL_TEMPLATES.find((t) => t.key === key)!;
    return NextResponse.json({ ok: true, template: meta });
  }

  const rendered = await previewMailTemplate(key);
  if (!rendered) {
    return NextResponse.json(
      { ok: false, error: "Önizleme oluşturulamadı" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    key,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from: getDefaultFrom(),
  });
}

export async function POST(req: Request) {
  const auth = await assertPermission("mail_health", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    templateKey?: string;
    recipientEmail?: string;
  };

  const templateKey = body.templateKey?.trim();
  if (!templateKey || !isMailTemplateKey(templateKey)) {
    return NextResponse.json({ ok: false, error: "Geçersiz şablon" }, { status: 400 });
  }

  const to =
    body.recipientEmail?.trim() ||
    auth.user.email ||
    null;
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "Alıcı email bulunamadı" },
      { status: 400 }
    );
  }

  const rendered = await previewMailTemplate(templateKey);
  if (!rendered) {
    return NextResponse.json(
      { ok: false, error: "Şablon render edilemedi" },
      { status: 500 }
    );
  }

  const result = await sendMail({
    to,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text || rendered.subject,
    tags: [
      { name: "kind", value: "admin_template_test" },
      { name: "template", value: templateKey },
    ],
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Gönderim başarısız" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, to, messageId: result.id });
}
