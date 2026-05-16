/**
 * /admin/denetciler/ertelenenler — Ertelenmiş aksiyonların paneli (Adım 8)
 *
 * Sefa "ertele" kararı verdiği aksiyonlar burada listelenir.
 * Snooze süresi dolanlar otomatik /bekleyen sayfasına geri döner.
 *
 * Filtreler:
 *   - status=snoozed (default)
 *   - status=rejected (geçmiş red'ler)
 *   - status=applied (uygulanmışlar)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  AUDITOR_LABELS,
  AUDITOR_EMOJI,
  type AuditorPendingActionRow,
  type PendingActionStatus,
} from "@/lib/agents/_shared/types";

const STATUS_TABS: Array<{ id: PendingActionStatus; label: string; emoji: string }> = [
  { id: "snoozed", label: "Ertelenenler", emoji: "⏸" },
  { id: "rejected", label: "Reddedilenler", emoji: "✗" },
  { id: "applied", label: "Uygulananlar", emoji: "✓" },
];

const SEVERITY_STYLES = {
  critical: "bg-kirmizi/10 text-kirmizi ring-kirmizi/30",
  warning: "bg-saman/15 text-saman-koyu ring-saman/30",
  info: "bg-gri-100 text-gri-700 ring-gri-200",
} as const;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysFromNow(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diffMs / 86400_000);
  if (days <= 0) return "şimdi (yeniden gösterilecek)";
  return `${days} gün sonra`;
}

export default function ErtelenenlerPage() {
  const [tab, setTab] = useState<PendingActionStatus>("snoozed");
  const [items, setItems] = useState<AuditorPendingActionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/auditors/pending?status=${tab}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        items?: AuditorPendingActionRow[];
      };
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
          <Eyebrow>Karar Arşivi</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Geçmiş kararlar
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            Ertelediğin, reddettiğin ve uyguladığın aksiyonların geçmişi.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap mb-6 border-b border-gri-200 pb-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-4 rounded-t-lg text-[13px] font-semibold transition-colors",
                tab === t.id
                  ? "bg-white text-lacivert ring-1 ring-gri-200 ring-b-0"
                  : "text-gri-700 hover:text-pim-mercan"
              )}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <Card padding="p-6">
            <div className="animate-pulse text-gri-700">Yükleniyor…</div>
          </Card>
        ) : items.length === 0 ? (
          <Card padding="p-12">
            <div className="text-center">
              <div className="text-[48px] mb-3">📭</div>
              <h2 className="text-[18px] font-semibold text-lacivert mb-2">
                Burada kayıt yok
              </h2>
              <p className="text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
                Bu tab için kararın yok. Aksiyon önerileri{" "}
                <Link
                  href="/admin/denetciler/bekleyen"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  bekleyen
                </Link>{" "}
                sayfasında görünür.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} padding="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[20px]">
                      {AUDITOR_EMOJI[item.auditor_name]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gri-500 font-semibold uppercase tracking-[0.04em] mb-0.5">
                        {AUDITOR_LABELS[item.auditor_name]}
                      </div>
                      <h3 className="font-semibold text-[14px] text-lacivert leading-tight">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center h-[22px] px-2 rounded-full ring-1 text-[10.5px] font-bold shrink-0",
                      SEVERITY_STYLES[item.severity]
                    )}
                  >
                    {item.severity.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px] text-gri-700 mt-3 pt-3 border-t border-gri-100">
                  {tab === "snoozed" && (
                    <div>
                      <span className="text-gri-500 block text-[10.5px] uppercase font-semibold tracking-[0.04em]">
                        Yeniden gösterim
                      </span>
                      <span className="font-semibold text-lacivert">
                        {daysFromNow(item.snooze_until)}
                      </span>
                    </div>
                  )}
                  {tab === "applied" && (
                    <div>
                      <span className="text-gri-500 block text-[10.5px] uppercase font-semibold tracking-[0.04em]">
                        Uygulanma
                      </span>
                      <span className="font-semibold text-lacivert">
                        {fmtDate(item.applied_at)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gri-500 block text-[10.5px] uppercase font-semibold tracking-[0.04em]">
                      Karar
                    </span>
                    <span className="font-semibold text-lacivert">
                      {fmtDate(item.reviewed_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gri-500 block text-[10.5px] uppercase font-semibold tracking-[0.04em]">
                      Aksiyon tipi
                    </span>
                    <code className="font-mono text-[11.5px] text-lacivert">
                      {item.action_type}
                    </code>
                  </div>
                </div>

                {item.review_note && (
                  <div className="mt-3 pt-3 border-t border-gri-100 text-[12.5px] text-gri-700 italic">
                    📝 {item.review_note}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
