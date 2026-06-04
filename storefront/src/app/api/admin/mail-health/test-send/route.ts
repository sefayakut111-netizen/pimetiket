/**
 * POST /api/admin/mail-health/test-send
 * Giriş yapan admin'e anında test maili gönderir.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { getDefaultFrom, isResendConfigured, sendMail } from "@/lib/mail/resend";

export async function POST(req: Request) {
  const auth = await assertPermission("mail_health", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Sefa 4 Haz: opsiyonel hedef — admin@ kutusu yok, info@'ya test atılabilsin.
  // Güvenlik: yalnız @pimetiket.com (admin keyfi dış adrese test maili atamasın).
  let to = auth.user.email ?? "";
  const body = (await req.json().catch(() => ({}))) as { to?: string };
  const reqTo =
    typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  if (reqTo) {
    if (!reqTo.endsWith("@pimetiket.com")) {
      return NextResponse.json(
        { ok: false, error: "Hedef yalnız @pimetiket.com olabilir" },
        { status: 400 }
      );
    }
    to = reqTo;
  }
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "admin_email_missing" },
      { status: 400 }
    );
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY eksik" },
      { status: 500 }
    );
  }

  const now = new Date().toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const result = await sendMail({
    to,
    subject: `Test mail — ${now}`,
    html: `
<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;color:#0a1928;">Mail altyapısı testi</h1>
  <p style="color:#334155;line-height:1.6;">
    Bu mail <strong>/admin/mail-health</strong> sayfasından gönderildi.
  </p>
  <p style="font-size:13px;color:#64748b;">
    From: ${getDefaultFrom()}<br>
    Zaman: ${now}
  </p>
</div>`.trim(),
    text: `Pim Etiket test mail — ${now}\nFrom: ${getDefaultFrom()}`,
    tags: [{ name: "category", value: "admin_test" }],
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "send_failed",
      hint:
        result.error?.includes("domain") || result.error?.includes("verify")
          ? "Resend domain henüz verified değil — DNS kayıtlarını kontrol et."
          : undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    to,
    messageId: result.id ?? null,
    sentAt: now,
  });
}
