/**
 * GET /api/cron/auditors/daily-digest
 *
 * Sefa için TEK mail — tüm 10 agent'ın son run özetini birleştirir.
 *
 * Cron: günlük sabah 08:00 (finance + ai_cost + compliance'den önce).
 *
 * Akış:
 *   - v_auditor_latest_runs view'ından her agent için son run çek
 *   - Toplam: # bulgu, # kritik, # warning
 *   - Markdown rapor + HTML mail
 *   - sefayakut111@gmail.com'a Resend ile gönder
 *
 * Auth: Bearer CRON_SECRET
 */

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";
import {
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  AUDITOR_NAMES,
  type AuditorName,
  type AuditorLatestRunSummary,
  type RunStatus,
} from "@/lib/agents/_shared/types";
import { unsnoozeExpiredActions } from "@/lib/agents/_shared/unsnooze";
import { getAuditorNotifyEmails } from "@/lib/admin-recipients";

/** Bu süreden uzun çalışmayan denetçiler stale sayılır */
const STALE_AUDITOR_DAYS = 7;

interface LatestRunRow {
  auditor_name: string;
  latest_run_id: string | null;
  started_at: string | null;
  status: string | null;
  findings_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  summary: string | null;
}

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600_000);
  if (diffH < 24) return `${diffH} sa önce`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} gün önce`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor(
    (Date.now() - new Date(iso).getTime()) / (86400_000)
  );
}

function getStaleAuditors(
  summaries: AuditorLatestRunSummary[]
): AuditorLatestRunSummary[] {
  return summaries.filter((a) => {
    if (!a.latestRunId || !a.startedAt) return true;
    const days = daysSince(a.startedAt);
    return days !== null && days >= STALE_AUDITOR_DAYS;
  });
}

export async function GET(req: Request) {
  // Auth — Sefa 23 May v68 (P1.3): assertCronAuth (timing-safe).
  const guard = assertCronAuth(req);
  if (guard) return guard;

  try {
    const payload = await withCronRun<Record<string, unknown>>("auditors-daily-digest", async () => {
      const admin = createAdminClient();

      // Süresi dolmuş ertelenen aksiyonları bekleyen kuyruğa al (digest pending sayısı doğru olsun)
      await unsnoozeExpiredActions(admin);

      // Son run'ları çek
      const { data, error } = await admin
        .from("v_auditor_latest_runs")
        .select(
          "auditor_name, latest_run_id, started_at, status, findings_count, critical_count, warning_count, info_count, summary"
        );

      if (error) {
        throw new Error(error.message);
      }

  const rows = (data ?? []) as unknown as LatestRunRow[];
  const runMap = new Map(rows.map((r) => [r.auditor_name, r]));

  // 10 agent için sıralı liste
  const summaries: AuditorLatestRunSummary[] = AUDITOR_NAMES.map((name) => {
    const r = runMap.get(name);
    return {
      auditorName: name,
      latestRunId: r?.latest_run_id ?? null,
      startedAt: r?.started_at ?? null,
      finishedAt: null,
      durationMs: null,
      status: (r?.status ?? null) as RunStatus | null,
      findingsCount: r?.findings_count ?? 0,
      criticalCount: r?.critical_count ?? 0,
      warningCount: r?.warning_count ?? 0,
      infoCount: r?.info_count ?? 0,
      summary: r?.summary ?? null,
    };
  });

  // Toplamlar
  const totalCritical = summaries.reduce((s, a) => s + a.criticalCount, 0);
  const totalWarning = summaries.reduce((s, a) => s + a.warningCount, 0);
  const neverRun = summaries.filter((a) => !a.latestRunId).length;
  const staleAuditors = getStaleAuditors(summaries);

  // Pending action sayısı
  const { count: pendingCount } = await admin
    .from("auditor_pending_actions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // Mail içeriği
  const subject =
    staleAuditors.length > 0
      ? `⚠️ Pim Etiket Brifing — ${staleAuditors.length} denetçi ${STALE_AUDITOR_DAYS}+ gün çalışmadı`
      : totalCritical > 0
      ? `🔴 Pim Etiket Günlük Brifing — ${totalCritical} KRİTİK`
      : totalWarning > 0
        ? `🟡 Pim Etiket Günlük Brifing — ${totalWarning} uyarı`
        : `✅ Pim Etiket Günlük Brifing — temiz`;

  const html = renderHtml({
    summaries,
    totalCritical,
    totalWarning,
    neverRun,
    staleAuditors,
    pendingCount: pendingCount ?? 0,
  });

      // Mail at
      if (!isResendConfigured()) {
        return {
          summary: "Resend yapılandırılmamış — digest gönderilmedi",
          itemsProcessed: 0,
          data: {
            ok: false,
            reason: "resend_not_configured",
            previewed: subject,
          },
        };
      }

      const recipients = await getAuditorNotifyEmails();

      if (recipients.length === 0) {
        return {
          summary: "Alıcı yok — digest gönderilmedi",
          itemsProcessed: 0,
          data: {
            ok: false,
            reason: "no_recipients",
          },
        };
      }

      const result = await sendMail({
        to: recipients,
        subject,
        html,
        text: subject,
      });

      const responseData = {
        ok: result.ok,
        sent: result.ok ? recipients : [],
        totalCritical,
        totalWarning,
        neverRun,
        pendingCount,
        staleCount: staleAuditors.length,
      };

      return {
        summary: `Digest mail ${result.ok ? "gönderildi" : "başarısız"} — ${totalCritical} kritik, ${totalWarning} uyarı`,
        itemsProcessed: result.ok ? recipients.length : 0,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/auditors-daily-digest]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// ============================================================
// HTML render
// ============================================================

function renderHtml(opts: {
  summaries: AuditorLatestRunSummary[];
  totalCritical: number;
  totalWarning: number;
  neverRun: number;
  staleAuditors: AuditorLatestRunSummary[];
  pendingCount: number;
}): string {
  const staleSet = new Set(opts.staleAuditors.map((a) => a.auditorName));

  const rows = opts.summaries
    .map((a) => {
      const emoji = AUDITOR_EMOJI[a.auditorName as AuditorName];
      const label = AUDITOR_LABELS[a.auditorName as AuditorName];
      const isStale = staleSet.has(a.auditorName);
      const status = !a.latestRunId
        ? `<span style="color:#dc2626;font-weight:600">— henüz çalışmadı</span>`
        : isStale
          ? `<span style="color:#dc2626;font-weight:600">⚠ ${STALE_AUDITOR_DAYS}+ gün sessiz</span>`
          : a.criticalCount > 0
          ? `<span style="color:#dc2626;font-weight:600">${a.criticalCount} kritik</span>`
          : a.warningCount > 0
            ? `<span style="color:#ca8a04;font-weight:600">${a.warningCount} uyarı</span>`
            : `<span style="color:#16a34a">✓ temiz</span>`;

      const time = fmtTime(a.startedAt);

      return `
<tr>
  <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
    <span style="font-size:18px;margin-right:6px;">${emoji}</span>
    <strong style="color:#0a1928">${label}</strong>
  </td>
  <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12.5px;color:#475569;">
    ${status}<br>
    <span style="font-size:11px;color:#94a3b8">${time}</span>
  </td>
</tr>`;
    })
    .join("");

  const pendingBanner =
    opts.pendingCount > 0
      ? `
<div style="background:${opts.totalCritical > 0 ? "#fee2e2" : "#fef3c7"};border-radius:8px;padding:12px 16px;margin:0 0 16px;color:${opts.totalCritical > 0 ? "#991b1b" : "#92400e"};font-size:13px;font-weight:600;">
  🔔 ${opts.pendingCount} aksiyon senin onayını bekliyor
  <a href="${SITE_URL()}/admin/denetciler/bekleyen" style="color:inherit;text-decoration:underline;margin-left:8px;">İncele →</a>
</div>`
      : "";

  const staleBanner =
    opts.staleAuditors.length > 0
      ? `
<div style="background:#fee2e2;border-radius:8px;padding:12px 16px;margin:0 0 16px;color:#991b1b;font-size:13px;font-weight:600;">
  ⚠️ ${opts.staleAuditors.length} denetçi ${STALE_AUDITOR_DAYS}+ gündür çalışmadı: ${opts.staleAuditors
        .map((a) => AUDITOR_LABELS[a.auditorName])
        .join(", ")}
  <a href="${SITE_URL()}/admin/denetciler" style="color:inherit;text-decoration:underline;margin-left:8px;">Kontrol et →</a>
</div>`
      : "";

  return `
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px 16px;">
  <div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <div style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px;">
      🦉 Pim Etiket — Günlük Denetçi Brifingi
    </div>
    <h1 style="margin:0 0 20px;font-size:22px;color:#0a1928;font-weight:600;line-height:1.3;">
      ${opts.totalCritical > 0 ? `🔴 ${opts.totalCritical} kritik` : opts.totalWarning > 0 ? `🟡 ${opts.totalWarning} uyarı` : "✅ Sistem temiz"}
      ${opts.neverRun > 0 ? ` <span style="color:#94a3b8;font-weight:400;font-size:14px">· ${opts.neverRun} agent henüz çalışmadı</span>` : ""}
    </h1>

    ${pendingBanner}
    ${staleBanner}

    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      ${rows}
    </table>

    <a href="${SITE_URL()}/admin/denetciler" style="display:inline-block;background:#ed4d3c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9999px;font-weight:600;font-size:13px;">
      Dashboard'a git →
    </a>

    <p style="font-size:11.5px;color:#94a3b8;margin:24px 0 0;line-height:1.5;">
      Bu mail her gün sabah 08:00'de otomatik gönderilir. Bildirimleri kapatmak için Vercel env <code>AUDITOR_NOTIFY_EMAILS</code> alanını boşalt.
    </p>
  </div>
</div>`.trim();
}
