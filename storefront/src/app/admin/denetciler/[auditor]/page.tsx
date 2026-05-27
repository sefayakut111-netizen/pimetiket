/**
 * /admin/denetciler/[auditor] — Tek auditor detay sayfası
 *
 * Sefa burada şunları görür:
 *   - Son run özeti (verdict + finding count)
 *   - Markdown rapor (mailde gelenle aynı)
 *   - Tüm finding'ler (severity sırasıyla)
 *   - Bu auditor'a ait pending action'lar
 *   - Son 30 günlük trend (Adım 8'de chart)
 *   - "Şimdi çalıştır" butonu (Adım 4'te aktif olacak)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { use as useParamsAsync } from "react";
import { Card, Eyebrow, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ApprovalCard } from "@/components/admin/auditors/ApprovalCard";
import { TrendSparkline } from "@/components/admin/auditors/TrendSparkline";
import {
  AUDITOR_NAMES,
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorFindingRow,
  type AuditorName,
  type AuditorPendingActionRow,
  type AuditorRunRow,
} from "@/lib/agents/_shared/types";

interface DetailResponse {
  ok: boolean;
  auditor: string;
  latestRunId: string | null;
  latestRun: AuditorRunRow | null;
  recentRuns: AuditorRunRow[];
  findings: AuditorFindingRow[];
  pendingActions: AuditorPendingActionRow[];
  error?: string;
}

// Canlı olan auditor'lar — "Şimdi çalıştır" sadece bunlarda aktif.
// Adım 7 ile 9 agent tam set canlı.
const LIVE_AUDITORS: ReadonlySet<string> = new Set([
  "security",
  "finance",
  "workflow",
  "compliance",
  "ai_cost",
  "data_hygiene",
  "customer_health",
  "seo",
  "brand",
]);

const SEVERITY_STYLES = {
  critical: "bg-kirmizi/10 text-kirmizi ring-kirmizi/30",
  warning: "bg-saman/15 text-saman-koyu ring-saman/30",
  info: "bg-gri-100 text-gri-700 ring-gri-200",
} as const;

const SEVERITY_LABEL = {
  critical: " KRİTİK",
  warning: " UYARI",
  info: " BİLGİ",
} as const;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AuditorDetailPage({
  params,
}: {
  params: Promise<{ auditor: string }>;
}) {
  const { auditor } = useParamsAsync(params);
  const isValid = (AUDITOR_NAMES as readonly string[]).includes(auditor);
  const auditorName = isValid ? (auditor as AuditorName) : null;

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSuccess, setRunSuccess] = useState<string | null>(null);

  const isLive = auditorName && LIVE_AUDITORS.has(auditorName);

  const refresh = useCallback(async () => {
    if (!auditorName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/auditors/${auditorName}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as DetailResponse;
      if (!json.ok) {
        setError(json.error ?? "fetch_failed");
        setData(null);
      } else {
        setError(null);
        setData(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [auditorName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleManualRun = async () => {
    if (!auditorName || running || !isLive) return;
    setRunning(true);
    setRunError(null);
    setRunSuccess(null);
    try {
      const res = await fetch(`/api/admin/auditors/${auditorName}/run`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        runId?: string;
        error?: string;
        message?: string;
      };
      if (!json.ok) {
        setRunError(json.message ?? json.error ?? "Çalıştırma başarısız");
      } else {
        // Yeni run'ı yükle + başarı feedback
        await refresh();
        setRunSuccess("Tarama tamamlandı, son sonuç yüklendi");
        // 4 sn sonra success mesajını gizle
        setTimeout(() => setRunSuccess(null), 4000);
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Ağ hatası");
    } finally {
      setRunning(false);
    }
  };

  if (!isValid || !auditorName) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight">
            Bilinmeyen denetçi
          </h1>
          <p className="mt-3 text-base text-gri-700">
            <code className="font-mono">{auditor}</code> isimli bir agent yok.
          </p>
          <Link
            href="/admin/denetciler"
            className="inline-block mt-6 text-pim-mercan font-semibold hover:underline"
          >
            ← Denetçilere geri dön
          </Link>
        </div>
      </main>
    );
  }

  const emoji = AUDITOR_EMOJI[auditorName];
  const label = AUDITOR_LABELS[auditorName];

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12.5px] mb-3">
          <Link
            href="/admin/denetciler"
            className="text-gri-700 hover:text-pim-mercan transition-colors"
          >
            ← Denetçiler
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>Domain Denetçi</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              <span className="mr-2">{emoji}</span>
              {label}
            </h1>
            <p className="mt-1.5 text-[12.5px] font-mono text-gri-500">
              {auditorName}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {isLive ? (
              <button
                type="button"
                onClick={() => void handleManualRun()}
                disabled={running}
                className={cn(
                  "inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-semibold transition-colors",
                  running
                    ? "bg-gri-100 text-gri-500 cursor-not-allowed"
                    : "bg-pim-mercan text-white hover:bg-pim-mercan-koyu"
                )}
              >
                {running ? "Calisiyor..." : "Simdi calistir"}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-gri-100 text-gri-500 text-[13px] font-semibold cursor-not-allowed"
                title="Bu agent henüz canlı değil — sonraki adımlarda eklenecek"
              >
                Simdi calistir (yakinda)
              </button>
            )}
            {runError && (
              <span className="text-[12.5px] text-kirmizi font-semibold">
                 {runError}
              </span>
            )}
            {runSuccess && (
              <span className="text-[12.5px] text-yesil font-semibold">
                 {runSuccess}
              </span>
            )}
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <Card padding="p-6" className="mb-4">
            <div className="animate-pulse text-gri-700">
              Detay yükleniyor…
            </div>
          </Card>
        )}

        {error && (
          <Card padding="p-4" className="mb-6 bg-kirmizi/5 ring-kirmizi/20">
            <div className="text-[13px] text-kirmizi">
              <strong>Veri alınamadı:</strong> {error}
            </div>
          </Card>
        )}

        {/* Empty state — henüz hiç run yok */}
        {!loading && data && !data.latestRun && (
          <Card padding="p-12">
            <div className="text-center">
              <div className="text-[13px] text-gri-500 mb-3">Yukleniyor</div>
              <h2 className="text-[20px] font-semibold text-lacivert mb-2">
                Bu denetçi henüz canlı değil
              </h2>
              <p className="text-[14px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
                <strong>{label}</strong> agent'ı Sefa'nın kuruluş takvimine
                göre eklenecek. Migration 040 (auditor framework) hazır,
                şu an sadece UI iskeleti.
              </p>
              <p className="text-[12.5px] text-gri-500 mt-4">
                İlk canlı agent: Adım 4 — Sistem Güvenliği
              </p>
            </div>
          </Card>
        )}

        {/* Latest run summary */}
        {!loading && data?.latestRun && (
          <>
            <Card padding="p-6" className="mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700">
                    Son çalışma
                  </div>
                  <div className="text-[15px] font-semibold text-lacivert mt-1">
                    {fmtDate(data.latestRun.started_at)}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700">
                    Süre
                  </div>
                  <div className="text-[15px] font-semibold text-lacivert mt-1">
                    {fmtDuration(data.latestRun.duration_ms)}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700">
                    Bulgu
                  </div>
                  <div className="text-[15px] font-semibold text-lacivert mt-1">
                    {data.latestRun.findings_count}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700">
                    Bekleyen
                  </div>
                  <div className="text-[15px] font-semibold text-lacivert mt-1">
                    {data.pendingActions.filter((p) => p.status === "pending").length}
                  </div>
                </div>
              </div>
              {data.latestRun.summary && (
                <div className="mt-4 pt-4 border-t border-gri-100 text-[14px] text-lacivert leading-relaxed">
                  {data.latestRun.summary}
                </div>
              )}
            </Card>

            {/* Pending actions for this auditor */}
            {data.pendingActions.filter((p) => p.status === "pending").length >
              0 && (
              <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-lacivert mb-3">
                  Onayını bekleyen aksiyonlar (
                  {
                    data.pendingActions.filter((p) => p.status === "pending")
                      .length
                  }
                  )
                </h2>
                <div className="space-y-3">
                  {data.pendingActions
                    .filter((p) => p.status === "pending")
                    .map((action) => (
                      <ApprovalCard
                        key={action.id}
                        action={action}
                        onDecided={() => void refresh()}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Findings */}
            {data.findings.length > 0 && (
              <Card padding="p-6" className="mb-4">
                <h2 className="text-[16px] font-semibold text-lacivert mb-3">
                  Tespitler ({data.findings.length})
                </h2>
                <div className="space-y-3">
                  {data.findings.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-lg ring-1 ring-gri-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                        <div className="font-semibold text-[14px] text-lacivert flex-1 min-w-0">
                          {f.title}
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center h-[20px] px-2 rounded-full ring-1 text-[10.5px] font-bold shrink-0",
                            SEVERITY_STYLES[f.severity]
                          )}
                        >
                          {SEVERITY_LABEL[f.severity]}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-gri-700 leading-relaxed">
                        {f.description}
                      </p>
                      {f.suggested_action_description && (
                        <div className="mt-2 pt-2 border-t border-gri-100 text-[12px] text-gri-700 italic">
                          → Önerilen: {f.suggested_action_description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Markdown rapor */}
            {data.latestRun.summary_md && (
              <Card padding="p-6" className="mb-4">
                <h2 className="text-[16px] font-semibold text-lacivert mb-3">
                  Detaylı rapor
                </h2>
                <pre className="bg-gri-50 rounded-lg p-4 text-[12.5px] text-lacivert whitespace-pre-wrap font-mono leading-relaxed">
                  {data.latestRun.summary_md}
                </pre>
              </Card>
            )}

            {/* Trend grafikleri (Adım 8 polish) */}
            {data.recentRuns.length > 1 && (
              <Card padding="p-6" className="mb-4">
                <h2 className="text-[16px] font-semibold text-lacivert mb-4">
                  Son {data.recentRuns.length} run trendi
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TrendSparkline
                    data={data.recentRuns}
                    metric="findings"
                    label=" Toplam bulgu"
                  />
                  <TrendSparkline
                    data={data.recentRuns}
                    metric="critical"
                    label=" Kritik"
                  />
                  <TrendSparkline
                    data={data.recentRuns}
                    metric="warning"
                    label=" Uyarı"
                  />
                  <TrendSparkline
                    data={data.recentRuns}
                    metric="duration"
                    label="⏱ Süre (s)"
                  />
                </div>
              </Card>
            )}

            {/* Geçmiş runs tablosu */}
            {data.recentRuns.length > 1 && (
              <Card padding="p-6">
                <h2 className="text-[16px] font-semibold text-lacivert mb-3">
                  Geçmiş run kayıtları
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-gri-700 text-left">
                        <th className="pb-2 font-semibold">Tarih</th>
                        <th className="pb-2 font-semibold">Süre</th>
                        <th className="pb-2 font-semibold">Bulgu</th>
                        <th className="pb-2 font-semibold">Kritik</th>
                        <th className="pb-2 font-semibold">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentRuns.slice(0, 20).map((r) => (
                        <tr
                          key={r.id}
                          className="border-t border-gri-100 text-lacivert"
                        >
                          <td className="py-2">{fmtDate(r.started_at)}</td>
                          <td className="py-2">{fmtDuration(r.duration_ms)}</td>
                          <td className="py-2 tabular-nums">{r.findings_count}</td>
                          <td className="py-2 tabular-nums">
                            {r.critical_count > 0 ? (
                              <span className="text-kirmizi font-semibold">
                                {r.critical_count}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2">
                            <Pill>{r.status}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        <div className="mt-8 text-center text-[12px] text-gri-500">
          Trend grafikleri ve "Şimdi çalıştır" butonu sonraki adımlarda
          aktifleşecek.
        </div>
      </div>
    </main>
  );
}
