/**
 * POST /api/admin/auditors/test-mail
 *
 * Sefa'nın Resend domain doğrulamasını anında test edebileceği endpoint.
 * /admin/denetciler ana sayfaya buton ekler.
 *
 * Akış:
 *   1. Resend'e direkt test mail at
 *   2. Başarılı → "Mail gönderildi" + Resend message ID
 *   3. Başarısız (domain pending vb) → açıklayıcı hata
 *
 * Yararı: Sefa Resend domain status'unu UI'dan check etmek zorunda
 * kalmaz; manuel test → cevap anında.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";

export async function POST() {
  const auth = await assertPermission("auditors", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "RESEND_API_KEY env'de yok",
      },
      { status: 500 }
    );
  }

  const recipients = (process.env.AUDITOR_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "AUDITOR_NOTIFY_EMAILS env'de yok",
      },
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
    to: recipients,
    subject: `🧪 Test mail — ${now}`,
    html: `
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px;">
      🦉 Pim Etiket — Manuel Test
    </div>
    <h1 style="margin:0 0 12px;font-size:22px;color:#0a1928;font-weight:600;">
      ✅ Mail altyapısı çalışıyor
    </h1>
    <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 16px;">
      Bu mail Sefa tarafından <strong>/admin/denetciler</strong> sayfasından
      manuel tetiklenen test mailidir.
    </p>
    <p style="font-size:13px;color:#475569;margin:0 0 8px;">
      <strong>From:</strong> info@pimetiket.com<br>
      <strong>Zaman:</strong> ${now}<br>
      <strong>Tetikleyen:</strong> ${auth.user.email ?? auth.user.id}
    </p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin:16px 0;color:#166534;font-size:13px;">
      ✅ Domain Resend'de <strong>verified</strong> — denetçi sistemi mail
      bildirimleri çalışır durumda.
    </div>
    <p style="font-size:11.5px;color:#94a3b8;margin:0;">
      Bu mail otomatik değildir — manuel test butonu sonucu.
    </p>
  </div>
</div>`.trim(),
    text: `Pim Etiket test mail — ${now}\n\nMail altyapısı çalışıyor.\nFrom: info@pimetiket.com\nTetikleyen: ${auth.user.email ?? auth.user.id}`,
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error:
        "result" in result
          ? String(result)
          : "Resend reddetti — büyük ihtimalle domain pending. Resend dashboard kontrol et.",
      hint: "https://resend.com/domains adresinden pimetiket.com status'unu kontrol et",
    });
  }

  return NextResponse.json({
    ok: true,
    recipients,
    messageId: (result as { messageId?: string }).messageId ?? null,
    sentAt: now,
  });
}
