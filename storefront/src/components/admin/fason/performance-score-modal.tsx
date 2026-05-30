"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { FasonPartnerPerformance } from "@/components/admin/fason/fason-types";

function MetricCell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const valueClass = {
    neutral: "text-lacivert",
    good: "text-yesil",
    warn: "text-sari-koyu",
    bad: "text-kirmizi",
  }[tone];

  return (
    <div className="rounded-lg bg-gri-50 p-2.5">
      <div className="text-[10px] text-gri-500">{label}</div>
      <div className={cn("text-[16px] font-bold tabular-nums", valueClass)}>
        {value}
      </div>
    </div>
  );
}

export function PerformanceScoreModal({
  partnerId,
  partnerName,
  open,
  onClose,
}: {
  partnerId: string;
  partnerName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FasonPartnerPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/performance`
      );
      const json = (await res.json()) as FasonPartnerPerformance & {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Yuklenemedi");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Ag hatasi");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const scorePct =
    data?.cached_score == null ? null : Math.round(data.cached_score * 100);
  const onTimePct =
    data?.on_time_rate == null ? null : Math.round(data.on_time_rate * 100);
  const issuePct =
    data?.issue_rate == null ? null : Math.round(data.issue_rate * 100);
  const returnPct =
    data?.return_rate == null ? null : Math.round(data.return_rate * 100);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Performans — ${partnerName}`}
      maxWidthClassName="max-w-[520px]"
    >
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && error && (
        <p className="text-[13px] text-kirmizi">{error}</p>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="rounded-xl bg-lacivert/5 ring-1 ring-lacivert/10 px-4 py-3 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gri-600">
              Genel skor
            </span>
            <span className="text-[22px] font-bold text-lacivert tabular-nums">
              {scorePct != null ? `${scorePct}/100` : "—"}
            </span>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase text-gri-500 mb-2">
              Teslim ve iletisim
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <MetricCell
                label="Zamaninda teslim"
                value={onTimePct != null ? `%${onTimePct}` : "—"}
                tone={
                  onTimePct == null
                    ? "neutral"
                    : onTimePct >= 80
                      ? "good"
                      : "bad"
                }
              />
              <MetricCell
                label="Ort. yanit suresi"
                value={
                  data.avg_response_hours != null
                    ? `${data.avg_response_hours.toFixed(1)} saat`
                    : "—"
                }
                tone="neutral"
              />
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase text-gri-500 mb-2">
              Kalite
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <MetricCell
                label="Sorun orani"
                value={issuePct != null ? `%${issuePct}` : "—"}
                tone={
                  issuePct == null ? "neutral" : issuePct <= 5 ? "good" : "bad"
                }
              />
              <MetricCell
                label="Iade orani"
                value={returnPct != null ? `%${returnPct}` : "—"}
                tone={
                  returnPct == null
                    ? "neutral"
                    : returnPct <= 5
                      ? "good"
                      : "warn"
                }
              />
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase text-gri-500 mb-2">
              Atama istatistikleri
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <MetricCell
                label="Aktif is"
                value={String(data.active_assignments ?? 0)}
              />
              <MetricCell
                label="Tamamlanan"
                value={String(data.shipped_count ?? 0)}
              />
              <MetricCell
                label="Toplam atama"
                value={String(data.total_assignments ?? 0)}
              />
              <MetricCell
                label="Iptal / sorun"
                value={`${data.cancelled_count ?? 0} / ${data.issue_count ?? 0}`}
              />
            </div>
          </div>

          {data.score_updated_at && (
            <p className="text-[11px] text-gri-500">
              Skor guncelleme:{" "}
              {new Date(data.score_updated_at).toLocaleDateString("tr-TR")}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
