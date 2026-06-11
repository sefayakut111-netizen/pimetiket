/**
 * /admin/denetciler — Domain denetçi agent dashboard'u
 *
 * Sefa kuralı (16 May v3): 10 agent için tek bakış noktası.
 *
 * Layout:
 *   - Üst: pending action özet bar (kritik onaylar varsa kırmızı)
 *   - Orta: 10 kart grid (her agent için durum)
 *   - Alt: son 24 saat aktivite timeline (Adım 8'de gelecek)
 *
 * Adım 2'de: kartlar boş olabilir (henüz hiçbir agent çalışmadı).
 * Adım 4+ ile gerçek veriler dolacak.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  AUDITOR_NAMES,
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorLatestRunSummary,
  type PendingCountSummary,
} from "@/lib/agents/_shared/types";
// Sefa 17 May: Timeline + Aksiyon hub rehberi
import { AuditorTimeline } from "@/components/admin/auditors/AuditorTimeline";
import { ActionHubGuide } from "@/components/admin/auditors/ActionHubGuide";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

function severityChipClass(critical: number, warning: number) {
  if (critical > 0) return "bg-kirmizi/10 text-kirmizi ring-kirmizi/30";
  if (warning > 0) return "bg-saman/15 text-saman-koyu ring-saman/30";
  return "bg-yesil-soft/40 text-yesil ring-yesil/30";
}

// vercel.json cron schedule (UTC) → TR etiket (UTC+3) + UTC bazlı next-run
const CRON_SCHEDULE: Record<string, { label: string; nextRun: () => string }> = {
  security: {
    label: "Günlük 04:00 TR",
    nextRun: () => nextDailyAtUtc(1, 0),
  },
  finance: {
    label: "Z-raporu · 09:00 TR",
    nextRun: () => nextDailyAtUtc(6, 0),
  },
  workflow: {
    label: "Günlük 08:00 TR",
    nextRun: () => nextDailyAtUtc(5, 0),
  },
  ai_cost: {
    label: "Günlük 12:30 TR",
    nextRun: () => nextDailyAtUtc(9, 30),
  },
  compliance: {
    label: "Günlük 13:30 TR",
    nextRun: () => nextDailyAtUtc(10, 30),
  },
  data_hygiene: {
    label: "Pazar 06:00 TR",
    nextRun: () => nextWeeklyAtUtc(0, 3, 0),
  },
  customer_health: {
    label: "Pazartesi 13:00 TR",
    nextRun: () => nextWeeklyAtUtc(1, 10, 0),
  },
  seo: {
    label: "Çarşamba 14:00 TR",
    nextRun: () => nextWeeklyAtUtc(3, 11, 0),
  },
  brand: {
    label: "Cuma 17:00 TR",
    nextRun: () => nextWeeklyAtUtc(5, 14, 0),
  },
  app_health: {
    label: "Günlük 09:00 TR",
    nextRun: () => nextDailyAtUtc(6, 0),
  },
};

function nextDailyAtUtc(hour: number, minute: number): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0
    )
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return formatDiff(next.getTime() - now.getTime());
}

function nextWeeklyAtUtc(weekday: number, hour: number, minute: number): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0
    )
  );
  let daysUntil = (weekday - now.getUTCDay() + 7) % 7;
  if (daysUntil === 0 && next.getTime() <= now.getTime()) {
    daysUntil = 7;
  }
  next.setUTCDate(next.getUTCDate() + daysUntil);
  return formatDiff(next.getTime() - now.getTime());
}

function formatDiff(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} dk sonra`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa sonra`;
  const day = Math.floor(hr / 24);
  return `${day} gün sonra`;
}

function statusLabel(summary: AuditorLatestRunSummary): string {
  if (!summary.latestRunId) return "Henüz çalışmadı";
  if (summary.criticalCount > 0)
    return `${summary.criticalCount} kritik`;
  if (summary.warningCount > 0) return `${summary.warningCount} uyarı`;
  return "Temiz";
}

function statusIcon(summary: AuditorLatestRunSummary): string {
  if (!summary.latestRunId) return "—";
  if (summary.criticalCount > 0) return "";
  if (summary.warningCount > 0) return "";
  return "";
}

export default function DenetcilerDashboardPage() {
  const [data, setData] = useState<{
    auditors: AuditorLatestRunSummary[];
    pending: PendingCountSummary;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [runAllResult, setRunAllResult] = useState<string | null>(null);
  const [testingMail, setTestingMail] = useState(false);
  const [testMailResult, setTestMailResult] = useState<string | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auditors", { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        auditors?: AuditorLatestRunSummary[];
        pending?: PendingCountSummary;
        error?: string;
      };
      if (!json.ok || !json.auditors || !json.pending) {
        setError(json.error ?? "data_fetch_failed");
        setData(null);
      } else {
        setError(null);
        setData({ auditors: json.auditors, pending: json.pending });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleTestMail = async () => {
    if (testingMail) return;
    setTestingMail(true);
    setTestMailResult(null);
    try {
      const res = await fetch("/api/admin/auditors/test-mail", {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        recipients?: string[];
        messageId?: string | null;
        error?: string;
        hint?: string;
      };
      if (json.ok) {
        setTestMailResult(
          ` Mail gönderildi (${json.recipients?.[0] ?? "alıcı"})`
        );
      } else {
        setTestMailResult(
          ` ${json.error ?? "Hata"}${json.hint ? " — " + json.hint : ""}`
        );
      }
      setTimeout(() => setTestMailResult(null), 10000);
    } catch (err) {
      setTestMailResult(
        " " + (err instanceof Error ? err.message : "Ağ hatası")
      );
    } finally {
      setTestingMail(false);
    }
  };

  const handleSendDigest = async () => {
    if (sendingDigest) return;
    setSendingDigest(true);
    setDigestResult(null);
    try {
      const res = await fetch("/api/admin/auditors/daily-digest", {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: string[];
        totalCritical?: number;
        totalWarning?: number;
        error?: string;
      };
      if (json.ok) {
        setDigestResult(
          ` Digest gönderildi (${json.sent?.[0] ?? "alıcı"})`
        );
      } else {
        setDigestResult(` ${json.error ?? "Hata"}`);
      }
      setTimeout(() => setDigestResult(null), 8000);
    } catch (err) {
      setDigestResult(" " + (err instanceof Error ? err.message : "?"));
    } finally {
      setSendingDigest(false);
    }
  };

  const handleRunAll = async () => {
    if (runningAll) return;
    setRunningAll(true);
    setRunAllResult(null);
    try {
      const res = await fetch("/api/admin/auditors/run-all", {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        total?: number;
        succeeded?: number;
        failed?: number;
        totalDurationMs?: number;
      };
      if (json.ok) {
        const dur = Math.round((json.totalDurationMs ?? 0) / 1000);
        setRunAllResult(
          ` ${json.succeeded}/${json.total} agent çalıştı (${dur}s)`
        );
        await refresh();
      } else {
        setRunAllResult(" Hata oluştu");
      }
      setTimeout(() => setRunAllResult(null), 8000);
    } catch (err) {
      setRunAllResult(
        " " + (err instanceof Error ? err.message : "Ağ hatası")
      );
    } finally {
      setRunningAll(false);
    }
  };

  const auditors =
    data?.auditors ??
    AUDITOR_NAMES.map((name) => ({
      auditorName: name,
      latestRunId: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      status: null,
      findingsCount: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      summary: null,
    }));

  const cardAlertTotal = auditors.reduce(
    (sum, a) => sum + a.criticalCount + a.warningCount,
    0
  );
  const cardCriticalTotal = auditors.reduce((sum, a) => sum + a.criticalCount, 0);
  const cardWarningTotal = auditors.reduce((sum, a) => sum + a.warningCount, 0);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>Domain Denetçi Agent'lar</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Denetçiler
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              9 ajan sistemini günlük denetler. Kritik aksiyonlar için
              onay sana düşer.
            </p>
          </div>
          {/* Quick links — Adım 8 */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Tümünü çalıştır butonu */}
            <button
              type="button"
              onClick={() => void handleRunAll()}
              disabled={runningAll}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                runningAll
                  ? "bg-gri-100 text-gri-500 cursor-not-allowed"
                  : "bg-pim-mercan text-white hover:bg-pim-mercan-koyu"
              )}
            >
              {runningAll ? "Calisiyor..." : "Tumunu calistir"}
            </button>
            {runAllResult && (
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  runAllResult.startsWith("") ? "text-yesil" : "text-kirmizi"
                )}
              >
                {runAllResult}
              </span>
            )}
            {/* Test mail butonu — Resend domain doğrulaması anında test */}
            <button
              type="button"
              onClick={() => void handleTestMail()}
              disabled={testingMail}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                testingMail
                  ? "bg-gri-100 text-gri-500 cursor-not-allowed"
                  : "bg-white ring-1 ring-gri-200 text-lacivert hover:ring-pim-mercan"
              )}
              title="Resend mail altyapısını anında test et"
            >
              {testingMail ? "Test..." : "Test mail"}
            </button>
            {testMailResult && (
              <span
                className={cn(
                  "text-[12px] font-semibold max-w-[400px] truncate",
                  testMailResult.startsWith("")
                    ? "text-yesil"
                    : "text-kirmizi"
                )}
                title={testMailResult}
              >
                {testMailResult}
              </span>
            )}
            {/* Manuel Daily Digest tetikle */}
            <button
              type="button"
              onClick={() => void handleSendDigest()}
              disabled={sendingDigest}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                sendingDigest
                  ? "bg-gri-100 text-gri-500 cursor-not-allowed"
                  : "bg-white ring-1 ring-gri-200 text-lacivert hover:ring-pim-mercan"
              )}
              title="10 agent özetini içeren günlük brifing mailini şimdi at"
            >
              {sendingDigest ? "Gonder..." : "Digest gonder"}
            </button>
            {digestResult && (
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  digestResult.startsWith("") ? "text-yesil" : "text-kirmizi"
                )}
              >
                {digestResult}
              </span>
            )}
            <Link
              href="/admin/denetciler/bekleyen"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan transition-colors"
            >
               Bekleyen
            </Link>
            <Link
              href="/admin/denetciler/ertelenenler"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan transition-colors"
            >
              Karar arşivi
            </Link>
            <Link
              href="/admin/denetciler/gecmis"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan transition-colors"
            >
               Geçmiş
            </Link>
          </div>
        </div>

        {/* Sefa 17 May: Aksiyon hub rehberi — "bulgular için ne yapmalıyım?"
            sorusuna cevap. 4 adım: Bekleyen → Agent detayı → Arşiv → Geçmiş */}
        <ActionHubGuide />

        {/* Pending action bar */}
        {cardAlertTotal > 0 && (
          <Link
            href="/admin/denetciler/bekleyen"
            className={cn(
              "block mb-6 rounded-2xl p-4 ring-1 transition-all hover:scale-[1.01]",
              cardCriticalTotal > 0
                ? "bg-kirmizi/10 ring-kirmizi/30"
                : "bg-saman/15 ring-saman/30"
            )}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-[24px]"></span>
                <div>
                  <div className="font-semibold text-[15px] text-lacivert">
                    {cardAlertTotal} bulgu dikkat gerektiriyor
                  </div>
                  <div className="text-[12.5px] text-gri-700 mt-0.5">
                    {cardCriticalTotal > 0 && (
                      <span className="text-kirmizi font-semibold">
                        {cardCriticalTotal} kritik
                      </span>
                    )}
                    {cardCriticalTotal > 0 && cardWarningTotal > 0 && (
                      <span className="mx-1 text-gri-500">·</span>
                    )}
                    {cardWarningTotal > 0 && (
                      <span className="text-saman-koyu font-semibold">
                        {cardWarningTotal} uyari
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Pill>Incele →</Pill>
            </div>
          </Link>
        )}

        {/* Error */}
        {error && (
          <Card padding="p-4" className="mb-6 bg-kirmizi/5 ring-kirmizi/20">
            <div className="text-[13px] text-kirmizi">
              <strong>Veri alınamadı:</strong> {error}
            </div>
          </Card>
        )}

        {/* 10 agent grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {auditors.map((a) => {
            const isEmpty = !a.latestRunId;
            return (
              <Link
                key={a.auditorName}
                href={`/admin/denetciler/${a.auditorName}`}
                className={cn(
                  "block rounded-2xl bg-white ring-1 ring-gri-200 p-5 transition-all",
                  "hover:ring-pim-mercan hover:-translate-y-0.5 hover:shadow-1",
                  loading && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[28px]">
                      {AUDITOR_EMOJI[a.auditorName]}
                    </span>
                    <div>
                      <div className="font-semibold text-[14px] text-lacivert leading-tight">
                        {AUDITOR_LABELS[a.auditorName]}
                      </div>
                      <div className="text-[10.5px] text-gri-500 mt-0.5 font-mono">
                        {a.auditorName}
                      </div>
                    </div>
                  </div>
                  {!isEmpty && (
                    <span
                      className={cn(
                        "inline-flex items-center h-[22px] px-2 rounded-full ring-1 text-[11px] font-bold shrink-0",
                        severityChipClass(a.criticalCount, a.warningCount)
                      )}
                    >
                      {statusIcon(a)} {statusLabel(a)}
                    </span>
                  )}
                  {isEmpty && (
                    <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-gri-100 text-gri-700 text-[10.5px] font-semibold shrink-0">
                      Henüz çalışmadı
                    </span>
                  )}
                </div>

                <div className="text-[12px] text-gri-500 leading-relaxed">
                  {isEmpty
                    ? "Bu denetçi henüz canlı değil — Sefa kuruluş takvimine göre eklenecek."
                    : (
                      <>
                        Son: <span className="font-semibold text-lacivert">{timeAgo(a.startedAt)}</span>
                        {a.summary && (
                          <div className="text-[12px] text-gri-700 mt-1.5 line-clamp-2">
                            {a.summary}
                          </div>
                        )}
                      </>
                    )}
                </div>

                {/* Sonraki cron — Adım 8 polish v2 */}
                {!isEmpty && CRON_SCHEDULE[a.auditorName] && (
                  <div className="mt-3 pt-3 border-t border-gri-100 flex items-center justify-between text-[10.5px] text-gri-500">
                    <span>
                      {CRON_SCHEDULE[a.auditorName].label}
                    </span>
                    <span className="font-semibold text-pim-mercan">
                      {CRON_SCHEDULE[a.auditorName].nextRun()}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Sefa 17 May: Aktivite Timeline — son 24 saatte ne çalıştı, hangi
            bulgu çıktı (önceden "Adım 8'de gelecek" diye işaretliydi). */}
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
            <div>
              <Eyebrow>Aktivite</Eyebrow>
              <h2 className="mt-2 text-[20px] md:text-[24px] font-semibold tracking-tight text-lacivert">
                Son denetim akışı
              </h2>
              <p className="mt-1 text-[13px] text-gri-700">
                Son 7 gün içindeki tüm agent run'ları, en yeniden eskiye.
                Bir satıra tıkla → detay sayfası.
              </p>
            </div>
            <Link
              href="/admin/denetciler/gecmis"
              className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
            >
              Tüm geçmişi gör →
            </Link>
          </div>
          <AuditorTimeline limit={20} hoursWindow={168} />
        </section>

        {/* Footer note */}
        <div className="mt-8 text-center text-[12px] text-gri-500">
          Otomatik güncellenir. Manuel yenileme için sayfayı yeniden yükle.
        </div>
      </div>
    </main>
  );
}
