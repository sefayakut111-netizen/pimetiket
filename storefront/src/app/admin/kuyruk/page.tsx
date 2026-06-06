"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  PROOF_SLA_HOURS,
  QUEUE_MORE_HREFS,
  QUEUE_TYPE_LABELS,
  emptyQueueCounts,
  type OperationQueueResponse,
  type QueueItem,
  type QueueItemType,
  type QueueUrgency,
} from "@/lib/admin-operation-queue";

const REFRESH_MS = 30_000;
const REFRESH_TICK_MS = 10_000;

const KPI_TYPES: QueueItemType[] = [
  "ai_qc",
  "proof_sla",
  "fason_unassigned",
  "shipping",
  "support",
  "review",
  "capability",
];

const URGENCY_GROUP: Record<
  QueueUrgency,
  { label: string; emoji: string; className: string }
> = {
  critical: {
    label: "Acil (SLA riski)",
    emoji: "🔴",
    className: "border-kirmizi/30 bg-kirmizi-soft/30",
  },
  warning: {
    label: "Bugün yapılacak",
    emoji: "🟡",
    className: "border-sari/30 bg-sari-soft/30",
  },
  normal: {
    label: "Normal",
    emoji: "⚪",
    className: "border-gri-200 bg-white",
  },
};

function formatAge(hours?: number): string {
  if (hours == null) return "—";
  const h = Math.floor(hours);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rem = h % 24;
    return rem > 0 ? `${d}g ${rem}sa` : `${d}g`;
  }
  return `${h}sa`;
}

function proofRefundHint(item: QueueItem): string | null {
  if (item.type !== "proof_sla" || item.urgency !== "critical") return null;
  if (!item.deadline) return null;
  const remainingH =
    (new Date(item.deadline).getTime() - Date.now()) / 3_600_000;
  if (remainingH <= 0) return "SLA doldu — iade tetiklenebilir";
  if (remainingH < 2) return `${Math.ceil(remainingH)}sa içinde iade!`;
  return null;
}

export default function AdminKuyrukPage() {
  const [data, setData] = useState<OperationQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<QueueItemType | "all">("all");
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());
  const dataRef = useRef<OperationQueueResponse | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/operation-queue", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`fetch_${res.status}`);
      const json = (await res.json()) as OperationQueueResponse;
      setData(json);
      setError(null);
      setRefreshError(null);
      setLastRefresh(Date.now());
    } catch {
      if (dataRef.current) {
        setRefreshError("Güncellenemedi — son bilinen liste gösteriliyor");
      } else {
        setError("Kuyruk yüklenemedi");
        setRefreshError(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), REFRESH_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (typeFilter === "all") return data.items;
    return data.items.filter((i) => i.type === typeFilter);
  }, [data, typeFilter]);

  const shownByType = useMemo(() => {
    const m = emptyQueueCounts();
    if (!data) return m;
    for (const item of data.items) {
      m[item.type] += 1;
    }
    return m;
  }, [data]);

  const grouped = useMemo(() => {
    const groups: Record<QueueUrgency, QueueItem[]> = {
      critical: [],
      warning: [],
      normal: [],
    };
    for (const item of filteredItems) {
      groups[item.urgency].push(item);
    }
    return groups;
  }, [filteredItems]);

  const totalCount = data
    ? Object.values(data.counts).reduce((s, n) => s + n, 0)
    : 0;

  const refreshAgo = Math.floor((nowTick - lastRefresh) / 1000);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1100px] px-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <Eyebrow>Operasyon</Eyebrow>
            <h1 className="mt-2 text-[28px] font-semibold text-lacivert">
              Operasyon Kuyruğu
              {data && data.criticalCount > 0 && (
                <span className="ml-3 inline-flex items-center h-7 px-2.5 rounded-full bg-kirmizi text-white text-[13px] font-bold tabular-nums align-middle">
                  {data.criticalCount} acil prova
                </span>
              )}
            </h1>
            <p className="text-sm text-gri-600 mt-2">
              AI QC, prova SLA, fason atama, kargo, destek ve onay bekleyen
              işler — tek ekranda. Prova SLA: {PROOF_SLA_HOURS} saat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gri-500 tabular-nums">
              {refreshAgo < 5 ? "az önce" : `${refreshAgo} sn önce`} · 30sn
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!data) setLoading(true);
                void load();
              }}
            >
              <Icon.Refresh size={14} className="mr-1.5" />
              Yenile
            </Button>
          </div>
        </div>

        {loading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error && !data ? (
          <Card padding="p-6" className="text-kirmizi">
            {error}
          </Card>
        ) : data ? (
          <>
            {refreshError && (
              <div className="mb-4 rounded-lg bg-sari-soft/60 border border-sari/30 px-4 py-2.5 text-[13px] text-sari-koyu font-semibold flex items-center justify-between gap-3">
                <span>{refreshError}</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="text-[12px] underline shrink-0"
                >
                  Tekrar dene
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
              {KPI_TYPES.map((type) => {
                const count = data.counts[type];
                const shown = shownByType[type];
                const hidden = Math.max(0, count - shown);
                const active = typeFilter === type;
                return (
                  <div
                    key={type}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-pim-mercan bg-pim-mercan-tint ring-1 ring-pim-mercan/30"
                        : "border-gri-200 bg-white hover:bg-gri-50"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setTypeFilter((prev) => (prev === type ? "all" : type))
                      }
                      className="w-full text-left"
                    >
                      <div className="text-[22px] font-bold tabular-nums text-lacivert">
                        {count}
                      </div>
                      <div className="text-[11px] font-semibold text-gri-600 mt-0.5">
                        {QUEUE_TYPE_LABELS[type]}
                      </div>
                    </button>
                    {hidden > 0 && (
                      <Link
                        href={QUEUE_MORE_HREFS[type]}
                        className="mt-1 inline-block text-[10px] font-semibold text-pim-mercan hover:underline"
                      >
                        +{hidden} daha →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {typeFilter !== "all" && (
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className="text-[12px] text-pim-mercan font-semibold mb-4 hover:underline"
              >
                Tüm kuyrukları göster
              </button>
            )}

            {totalCount === 0 ? (
              <Card padding="p-10" className="text-center bg-yesil-soft/40">
                <div className="text-[32px] mb-2">🎉</div>
                <h2 className="text-[18px] font-semibold text-lacivert">
                  Kuyruk temiz!
                </h2>
                <p className="text-sm text-gri-600 mt-2">
                  Bekleyen acil iş yok.
                </p>
              </Card>
            ) : filteredItems.length === 0 ? (
              <Card padding="p-8" className="text-center text-gri-600">
                Bu kuyrukta bekleyen kayıt yok.
              </Card>
            ) : (
              <div className="space-y-6">
                {(["critical", "warning", "normal"] as const).map((urgency) => {
                  const group = grouped[urgency];
                  if (group.length === 0) return null;
                  const meta = URGENCY_GROUP[urgency];
                  return (
                    <section key={urgency}>
                      <h2 className="text-[13px] font-bold uppercase tracking-wider text-gri-600 mb-3 flex items-center gap-2">
                        <span>{meta.emoji}</span>
                        {meta.label}
                        <span className="text-gri-400 font-normal normal-case">
                          ({group.length})
                        </span>
                      </h2>
                      <div className="space-y-2">
                        {group.map((item) => {
                          const refundHint = proofRefundHint(item);
                          return (
                            <Card
                              key={item.id}
                              padding="p-0"
                              className={cn("overflow-hidden", meta.className)}
                            >
                              <div className="px-4 py-3.5 flex flex-wrap items-center gap-3">
                                <Link
                                  href={item.href}
                                  className="flex-1 min-w-[200px] hover:opacity-80 transition-opacity"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-gri-500">
                                      {QUEUE_TYPE_LABELS[item.type]}
                                    </span>
                                    {refundHint && (
                                      <span className="text-[10px] font-bold uppercase text-kirmizi bg-white/80 px-1.5 py-0.5 rounded">
                                        {refundHint}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-semibold text-[14px] text-lacivert mt-0.5">
                                    {item.title}
                                  </div>
                                  {item.subtitle && (
                                    <div className="text-[12px] text-gri-600 mt-0.5">
                                      {item.subtitle}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-gri-500 mt-1 tabular-nums">
                                    {formatAge(item.ageHours)} bekliyor
                                  </div>
                                </Link>
                                {item.actionLabel && (
                                  <Link href={item.href}>
                                    <Button variant="primary" size="sm">
                                      {item.actionLabel}
                                      <Icon.ArrowR size={14} className="ml-1" />
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
