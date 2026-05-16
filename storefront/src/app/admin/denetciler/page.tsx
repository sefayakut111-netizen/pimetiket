/**
 * /admin/denetciler — Domain denetçi agent dashboard'u
 *
 * Sefa kuralı (16 May v3): 9 agent için tek bakış noktası.
 *
 * Layout:
 *   - Üst: pending action özet bar (kritik onaylar varsa kırmızı)
 *   - Orta: 9 kart grid (her agent için durum)
 *   - Alt: son 24 saat aktivite timeline (Adım 8'de gelecek)
 *
 * Adım 2'de: kartlar boş olabilir (henüz hiçbir agent çalışmadı).
 * Adım 4+ ile gerçek veriler dolacak.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow, Pill } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import {
  AUDITOR_NAMES,
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorLatestRunSummary,
  type PendingCountSummary,
} from "@/lib/agents/_shared/types";

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

function statusLabel(summary: AuditorLatestRunSummary): string {
  if (!summary.latestRunId) return "Henüz çalışmadı";
  if (summary.criticalCount > 0)
    return `${summary.criticalCount} kritik`;
  if (summary.warningCount > 0) return `${summary.warningCount} uyarı`;
  return "Temiz";
}

function statusIcon(summary: AuditorLatestRunSummary): string {
  if (!summary.latestRunId) return "⏳";
  if (summary.criticalCount > 0) return "✗";
  if (summary.warningCount > 0) return "⚠";
  return "✓";
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
          `✓ ${json.succeeded}/${json.total} agent çalıştı (${dur}s)`
        );
        await refresh();
      } else {
        setRunAllResult("✗ Hata oluştu");
      }
      setTimeout(() => setRunAllResult(null), 8000);
    } catch (err) {
      setRunAllResult(
        "✗ " + (err instanceof Error ? err.message : "Ağ hatası")
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

  const pending = data?.pending ?? {
    criticalPending: 0,
    warningPending: 0,
    infoPending: 0,
    totalPending: 0,
  };

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
              {runningAll ? "⏳ Çalışıyor..." : "▶ Tümünü çalıştır"}
            </button>
            {runAllResult && (
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  runAllResult.startsWith("✓") ? "text-yesil" : "text-kirmizi"
                )}
              >
                {runAllResult}
              </span>
            )}
            <Link
              href="/admin/denetciler/bekleyen"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan transition-colors"
            >
              🔔 Bekleyen
            </Link>
            <Link
              href="/admin/denetciler/ertelenenler"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan transition-colors"
            >
              ⏸ Karar arşivi
            </Link>
            <Link
              href="/admin/denetciler/gecmis"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan transition-colors"
            >
              📋 Geçmiş
            </Link>
          </div>
        </div>

        {/* Pending action bar */}
        {pending.totalPending > 0 && (
          <Link
            href="/admin/denetciler/bekleyen"
            className={cn(
              "block mb-6 rounded-2xl p-4 ring-1 transition-all hover:scale-[1.01]",
              pending.criticalPending > 0
                ? "bg-kirmizi/10 ring-kirmizi/30"
                : "bg-saman/15 ring-saman/30"
            )}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-[24px]">🔔</span>
                <div>
                  <div className="font-semibold text-[15px] text-lacivert">
                    {pending.totalPending} aksiyon senin onayını bekliyor
                  </div>
                  <div className="text-[12.5px] text-gri-700 mt-0.5">
                    {pending.criticalPending > 0 && (
                      <span className="text-kirmizi font-semibold">
                        {pending.criticalPending} kritik
                      </span>
                    )}
                    {pending.criticalPending > 0 &&
                      pending.warningPending > 0 && (
                        <span className="mx-1 text-gri-500">·</span>
                      )}
                    {pending.warningPending > 0 && (
                      <span className="text-saman-koyu font-semibold">
                        {pending.warningPending} uyarı
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Pill>İncele →</Pill>
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

        {/* 9 agent grid */}
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
                      Çok yakında
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
              </Link>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center text-[12px] text-gri-500">
          Otomatik güncellenir. Manuel yenileme için sayfayı yeniden yükle.
        </div>
      </div>
    </main>
  );
}
