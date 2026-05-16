/**
 * /admin/denetciler/bekleyen — Onay bekleyen aksiyonlar
 *
 * Sefa'nın 4-yollu karar paneli (Adım 3'te onay kartı dolacak).
 * Şu an: liste + boş state.
 *
 * Filtreler (URL params):
 *   ?severity=critical|warning|info
 *   ?status=pending|all|approved|rejected|snoozed|applied
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorPendingActionRow,
} from "@/lib/agents/_shared/types";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

const SEVERITY_STYLES = {
  critical: "bg-kirmizi/10 text-kirmizi ring-kirmizi/30",
  warning: "bg-saman/15 text-saman-koyu ring-saman/30",
  info: "bg-gri-100 text-gri-700 ring-gri-200",
} as const;

const SEVERITY_LABELS = {
  critical: "🔴 KRİTİK",
  warning: "🟡 UYARI",
  info: "🔵 BİLGİ",
} as const;

export default function BekleyenPage() {
  const [items, setItems] = useState<AuditorPendingActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "pending" });
      if (filter !== "all") params.set("severity", filter);
      const res = await fetch(
        `/api/admin/auditors/pending?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        items?: AuditorPendingActionRow[];
      };
      setItems(json.items ?? []);
    } catch (err) {
      console.error("[bekleyen] fetch failed:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[12.5px] mb-2">
            <Link
              href="/admin/denetciler"
              className="text-gri-700 hover:text-pim-mercan transition-colors"
            >
              ← Denetçiler
            </Link>
          </div>
          <Eyebrow>Onay Kuyruğu</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Bekleyen aksiyonlar
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            Denetçi agent'ların önerdiği aksiyonlar — sen onayla, sistem
            uygulasın.
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap mb-6">
          {(
            [
              { id: "all", label: "Tümü" },
              { id: "critical", label: "🔴 Kritik" },
              { id: "warning", label: "🟡 Uyarı" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center h-[34px] px-4 rounded-full text-[13px] font-semibold transition-all",
                filter === f.id
                  ? "bg-lacivert text-white"
                  : "bg-white ring-1 ring-gri-200 text-lacivert hover:ring-pim-mercan"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <Card padding="p-6">
            <div className="animate-pulse text-gri-700">
              Onay kuyruğu yükleniyor…
            </div>
          </Card>
        ) : items.length === 0 ? (
          <Card padding="p-12">
            <div className="text-center">
              <div className="text-[48px] mb-3">✨</div>
              <h2 className="text-[20px] font-semibold text-lacivert mb-2">
                Kuyruk temiz
              </h2>
              <p className="text-[14px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
                Şu an Sefa onayı bekleyen aksiyon yok. Yeni öneri geldiğinde
                burada görünür.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card
                key={item.id}
                padding="p-5"
                className="hover:ring-pim-mercan transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="text-[20px]">
                      {AUDITOR_EMOJI[item.auditor_name]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] text-gri-500 mb-0.5 font-semibold uppercase tracking-[0.04em]">
                        {AUDITOR_LABELS[item.auditor_name]}
                      </div>
                      <h3 className="font-semibold text-[15px] text-lacivert leading-tight truncate">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center h-[24px] px-2.5 rounded-full ring-1 text-[11px] font-bold shrink-0",
                      SEVERITY_STYLES[item.severity]
                    )}
                  >
                    {SEVERITY_LABELS[item.severity]}
                  </span>
                </div>

                <p className="text-[13px] text-gri-700 leading-relaxed mb-3 line-clamp-3">
                  {item.description}
                </p>

                <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-gri-100">
                  <div className="text-[11.5px] text-gri-500">
                    {timeAgo(item.created_at)} · Aksiyon tipi:{" "}
                    <code className="font-mono text-lacivert">
                      {item.action_type}
                    </code>
                  </div>
                  {/* Onay butonları Adım 3'te gelecek */}
                  <Pill>İncele →</Pill>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Footer note */}
        <div className="mt-8 text-center text-[12px] text-gri-500">
          Onay/red/erteleme butonları Adım 3'te aktif olacak. Şu an liste
          görünümünde.
        </div>
      </div>
    </main>
  );
}
