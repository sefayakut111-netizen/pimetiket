/**
 * /admin/denetciler/gecmis — Auditor run geçmiş arama (Adım 8)
 *
 * Tüm run'ların listesi + filter (auditor / status / tarih).
 * Sefa "şu sorun ne zaman tespit edildi" diye geri bakabilir.
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
  type AuditorName,
  type AuditorRunRow,
} from "@/lib/agents/_shared/types";

interface RunSummary
  extends Pick<
    AuditorRunRow,
    | "id"
    | "auditor_name"
    | "started_at"
    | "finished_at"
    | "duration_ms"
    | "status"
    | "findings_count"
    | "critical_count"
    | "warning_count"
    | "summary"
  > {}

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

export default function GecmisPage() {
  const [filterAuditor, setFilterAuditor] = useState<AuditorName | "all">(
    "all"
  );
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">(
    "all"
  );
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (filterAuditor !== "all") params.set("auditor", filterAuditor);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const res = await fetch(`/api/admin/auditors/runs?${params}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        runs?: RunSummary[];
        total?: number;
      };
      setRuns(json.runs ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [filterAuditor, filterStatus, offset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Filter değişince offset'i sıfırla
  useEffect(() => {
    setOffset(0);
  }, [filterAuditor, filterStatus]);

  const showingFrom = offset + 1;
  const showingTo = Math.min(offset + limit, total);
  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[12.5px] mb-2">
            <Link
              href="/admin/denetciler"
              className="text-gri-700 hover:text-pim-mercan transition-colors"
            >
              ← Denetçiler
            </Link>
          </div>
          <Eyebrow>Rapor Geçmişi</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Geçmiş rapor arama
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            Tüm denetçi run'larının kaydı — filtrele, geri dön, incele.
          </p>
        </div>

        {/* Filters */}
        <Card padding="p-4" className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="filter-auditor"
                className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1.5"
              >
                Denetçi
              </label>
              <select
                id="filter-auditor"
                value={filterAuditor}
                onChange={(e) =>
                  setFilterAuditor(e.target.value as AuditorName | "all")
                }
                className="w-full h-10 px-3 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] text-lacivert focus:outline-none focus:ring-pim-mercan"
              >
                <option value="all">Tümü</option>
                {AUDITOR_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {AUDITOR_EMOJI[name]} {AUDITOR_LABELS[name]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-status"
                className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1.5"
              >
                Durum
              </label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(
                    e.target.value as "all" | "success" | "failed"
                  )
                }
                className="w-full h-10 px-3 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] text-lacivert focus:outline-none focus:ring-pim-mercan"
              >
                <option value="all">Tümü</option>
                <option value="success">Başarılı</option>
                <option value="failed">Başarısız</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Pagination header */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between text-[12.5px] text-gri-700 mb-3">
            <span>
              {showingFrom}–{showingTo} / {total} run
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={!hasPrev}
                className={cn(
                  "h-8 px-3 rounded-full text-[12px] font-semibold transition-colors",
                  hasPrev
                    ? "bg-white ring-1 ring-gri-200 text-lacivert hover:ring-pim-mercan"
                    : "bg-gri-100 text-gri-500 cursor-not-allowed"
                )}
              >
                ← Önceki
              </button>
              <button
                type="button"
                onClick={() => setOffset(offset + limit)}
                disabled={!hasMore}
                className={cn(
                  "h-8 px-3 rounded-full text-[12px] font-semibold transition-colors",
                  hasMore
                    ? "bg-white ring-1 ring-gri-200 text-lacivert hover:ring-pim-mercan"
                    : "bg-gri-100 text-gri-500 cursor-not-allowed"
                )}
              >
                Sonraki →
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <Card padding="p-6">
            <div className="animate-pulse text-gri-700">Yükleniyor…</div>
          </Card>
        ) : runs.length === 0 ? (
          <Card padding="p-12">
            <div className="text-center">
              <div className="text-[48px] mb-3">📋</div>
              <h2 className="text-[18px] font-semibold text-lacivert mb-2">
                Filtre eşleşmedi
              </h2>
              <p className="text-[13px] text-gri-700">
                Filtreleri gevşeterek tekrar dene.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={`/admin/denetciler/${r.auditor_name}?run=${r.id}`}
                className="block"
              >
                <Card
                  padding="p-4"
                  className="hover:ring-pim-mercan transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[20px]">
                        {AUDITOR_EMOJI[r.auditor_name as AuditorName]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[14px] text-lacivert leading-tight truncate">
                          {AUDITOR_LABELS[r.auditor_name as AuditorName]}
                        </div>
                        <div className="text-[11.5px] text-gri-500 mt-0.5 truncate">
                          {r.summary ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-gri-700 shrink-0 flex-wrap">
                      <span>{fmtDate(r.started_at)}</span>
                      <span className="font-mono text-gri-500">
                        {fmtDuration(r.duration_ms)}
                      </span>
                      {r.critical_count > 0 && (
                        <span className="text-kirmizi font-bold tabular-nums">
                          {r.critical_count} 🔴
                        </span>
                      )}
                      {r.warning_count > 0 && (
                        <span className="text-saman-koyu font-bold tabular-nums">
                          {r.warning_count} 🟡
                        </span>
                      )}
                      <Pill>{r.status}</Pill>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
