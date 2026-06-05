/**
 * GET /api/cron/kvkk-delete-audit
 *
 * Aylık KVKK silme follow-up: işlenmiş delete taleplerinde R2 arşiv
 * (`customers/{userId}/`) gerçekten temizlenmiş mi doğrular.
 * Temizlenmemiş varsa admin'e uyarı maili gönderir.
 *
 * Schedule: vercel.json → 0 4 1 * * (her ayın 1'i 04:00 UTC)
 * Auth: CRON_SECRET Bearer
 *
 * SADECE okur + raporlar — otomatik silme YOK.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { runKvkkDeleteAudit } from "@/lib/kvkk/delete-audit";
import { isResendConfigured, sendMail } from "@/lib/mail/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("kvkk-delete-audit", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const report = await runKvkkDeleteAudit(admin);

      let mailSent = false;
      if (report.pending_cleanup > 0 && report.r2Configured) {
        const recipients = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.includes("@"));

        if (recipients.length > 0 && isResendConfigured()) {
          const issueLines = report.issues
            .map(
              (i) =>
                `<li>Talep <code>${i.requestId}</code> (${i.kind}): <strong>${i.objectsFound}</strong> R2 objesi kaldı</li>`
            )
            .join("");

          const html = `
            <h2>KVKK silme audit — R2 temizlik uyarısı</h2>
            <p><strong>${report.pending_cleanup}</strong> işlenmiş silme talebinde R2 arşivinde hâlâ dosya var (KVKK m.7 riski).</p>
            <ul>${issueLines}</ul>
            <p>Kontrol edilen: ${report.checked}, temiz: ${report.clean}</p>
            <p><a href="${SITE_URL()}/admin/kvkk-talepleri">KVKK talepleri paneli</a> — manuel R2 temizliği gerekli.</p>
          `;

          const result = await sendMail({
            to: recipients,
            subject: `[Pim Etiket] KVKK audit: ${report.pending_cleanup} talepte R2 dosyası kaldı`,
            html,
            text: `${report.pending_cleanup} KVKK silme talebinde R2 dosyası hâlâ duruyor. Panel: ${SITE_URL()}/admin/kvkk-talepleri`,
          });
          mailSent = result.ok;
        }
      }

      return {
        summary:
          report.pending_cleanup > 0
            ? `KVKK audit: ${report.pending_cleanup}/${report.checked} talepte R2 temizlenmemiş`
            : `KVKK audit: ${report.checked} talep temiz`,
        itemsProcessed: report.checked,
        data: { ok: true, mailSent, ...report },
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/kvkk-delete-audit]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
