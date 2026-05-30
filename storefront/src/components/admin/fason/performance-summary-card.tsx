"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { FasonPartnerPerformance } from "@/components/admin/fason/fason-types";

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(score * 100)));
  const filled = Math.round(pct / 10);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gri-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-pim-mercan transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-gri-600 w-8 text-right">
        {filled}/10
      </span>
    </div>
  );
}

export function PerformanceSummaryCard({
  partnerId,
  partnerName,
  defaultLeadDays,
  cachedScore,
  onOpenDetail,
}: {
  partnerId: string;
  partnerName: string;
  defaultLeadDays: number;
  cachedScore: number | null;
  onOpenDetail: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FasonPartnerPerformance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/performance`
      );
      const json = (await res.json()) as FasonPartnerPerformance;
      if (res.ok) setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const score10 =
    cachedScore != null
      ? (cachedScore * 10).toFixed(1)
      : data?.cached_score != null
        ? (data.cached_score * 10).toFixed(1)
        : null;
  const onTimePct =
    data?.on_time_rate != null ? Math.round(data.on_time_rate * 100) : null;
  const returnPct =
    data?.return_rate != null
      ? (data.return_rate * 100).toFixed(1)
      : null;
  const avgDays =
    data?.avg_response_hours != null
      ? (data.avg_response_hours / 24).toFixed(1)
      : null;

  return (
    <section className="pb-4">
      <h3 className="text-[11px] font-bold uppercase text-gri-500 mb-3">
        Performans (Son 90 gun)
      </h3>

      {loading && !data ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : (
        <div className="rounded-xl border border-gri-200 bg-gri-50/40 p-3 space-y-3">
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-[12px] text-gri-600">Genel skor</span>
              <span className="text-[18px] font-bold text-lacivert tabular-nums">
                {score10 != null ? `${score10}/10` : "—"}
              </span>
            </div>
            {cachedScore != null && <ScoreBar score={cachedScore} />}
            {cachedScore == null && (
              <p className="text-[11px] text-gri-500">
                Ilk 5 is tamamlaninca hesaplanir
              </p>
            )}
          </div>

          <dl className="space-y-1.5 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-gri-600">Tamamlanan</dt>
              <dd className="font-semibold text-lacivert tabular-nums">
                {data?.shipped_count ?? 0} siparis
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gri-600">Zamaninda teslim</dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  onTimePct == null
                    ? "text-gri-400"
                    : onTimePct >= 80
                      ? "text-yesil"
                      : "text-kirmizi"
                )}
              >
                {onTimePct != null
                  ? `${Math.round((onTimePct / 100) * (data?.shipped_count ?? 0))} (%${onTimePct})`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gri-600">Iade orani</dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  returnPct == null
                    ? "text-gri-400"
                    : Number(returnPct) > 5
                      ? "text-sari-koyu"
                      : "text-lacivert"
                )}
              >
                {returnPct != null ? `%${returnPct}` : "—"}
                {returnPct != null && Number(returnPct) > 5 && " !"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gri-600">Ortalama hiz</dt>
              <dd className="font-semibold text-lacivert tabular-nums">
                {avgDays != null ? `${avgDays} gun` : `${defaultLeadDays} gun`}
              </dd>
            </div>
          </dl>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-pim-mercan"
            onClick={onOpenDetail}
          >
            Detaylari gor
          </Button>
        </div>
      )}
    </section>
  );
}
