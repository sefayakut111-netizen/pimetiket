/**
 * Pim Etiket — /admin/arsiv
 *
 * Sefa 18 May v68 (R2 cold storage admin panel):
 * Müşteri arşiv yönetimi — kim arşivde, ne kadar veri tutulmuş, arama.
 *
 * Yapı:
 *   - 4 KPI kart (Toplam aktif · Arşivde · Arşivleniyor · Geri alınıyor)
 *   - Durum filtre chip'i (Cold · Hot · Archiving · Restoring · Deleted · Tümü)
 *   - Arama (display_name match)
 *   - Tablo: müşteri · durum · arşivlendiği tarih · son sipariş · sipariş sayısı · işlem
 *   - "Dosyaları gör" → /admin/arsiv/[userId]
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, Input, Eyebrow, Skeleton, Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ArchiveCustomerRow } from "@/app/api/admin/archive/customers/route";

type StatusFilter =
  | "cold"
  | "hot"
  | "archiving"
  | "restoring"
  | "deleted"
  | "all";

const STATUS_META: Record<
  Exclude<StatusFilter, "all">,
  { label: string; emoji: string; color: string; bg: string }
> = {
  hot: {
    label: "Aktif",
    emoji: "🔥",
    color: "text-yesil-koyu",
    bg: "bg-yesil-soft",
  },
  archiving: {
    label: "Arşivleniyor",
    emoji: "⏳",
    color: "text-sari-koyu",
    bg: "bg-sari-soft",
  },
  cold: {
    label: "Arşivde",
    emoji: "❄️",
    color: "text-mavi-koyu",
    bg: "bg-mavi-soft",
  },
  restoring: {
    label: "Geri alınıyor",
    emoji: "🔄",
    color: "text-mor",
    bg: "bg-mor/10",
  },
  deleted: {
    label: "KVKK silindi",
    emoji: "🗑️",
    color: "text-kirmizi-koyu",
    bg: "bg-kirmizi-soft",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

export default function ArchiveAdminPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("cold");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [customers, setCustomers] = useState<ArchiveCustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      status: statusFilter,
      limit: "100",
    });
    if (debounced) params.set("search", debounced);

    fetch(`/api/admin/archive/customers?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setCustomers(data.customers ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((e) => {
        if (!cancelled) toast.error(`Yükleme hatası: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, debounced, toast]);

  // KPI'lar: tüm status'lerden count almak için ayrı sayım (basit yaklaşım: 4 fetch yerine tek "all" alıp client-side count)
  const kpis = useMemo(() => {
    const counts = { cold: 0, hot: 0, archiving: 0, restoring: 0, deleted: 0 };
    for (const c of customers) {
      const s = c.archive_status;
      if (s in counts) counts[s as keyof typeof counts] += 1;
    }
    return counts;
  }, [customers]);

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <div className="mb-6">
        <Eyebrow>R2 Cold Storage</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert md:text-3xl">
          Arşiv Yönetimi
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          Arşivlenmiş müşteri verilerini görüntüleyin, dosyalarına erişin,
          gerekirse manuel arşivleme veya geri alma yapın.
        </p>
      </div>

      {/* KPI özeti */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map(
          (s) => (
            <Card
              key={s}
              className={cn(
                "cursor-pointer p-4 transition hover:ring-2",
                STATUS_META[s].bg,
                statusFilter === s ? "ring-2 ring-pim-mercan" : ""
              )}
              onClick={() => setStatusFilter(s)}
            >
              <div className="flex items-center gap-2 text-[12px] text-gri-700">
                <span>{STATUS_META[s].emoji}</span>
                <span>{STATUS_META[s].label}</span>
              </div>
              <div
                className={cn("mt-1 text-2xl font-bold", STATUS_META[s].color)}
              >
                {loading ? <Skeleton className="h-7 w-12" /> : statusFilter === s ? total : kpis[s]}
              </div>
            </Card>
          )
        )}
      </div>

      {/* Filtre + arama */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {(["cold", "archiving", "restoring", "deleted", "hot", "all"] as StatusFilter[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition",
                    statusFilter === s
                      ? "bg-pim-mercan text-white"
                      : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                  )}
                >
                  {s === "all"
                    ? "Tümü"
                    : `${STATUS_META[s].emoji} ${STATUS_META[s].label}`}
                </button>
              )
            )}
          </div>
          <div className="ml-auto w-full max-w-xs">
            <Input
              placeholder="İsim ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Tablo */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gri-200 bg-gri-50 text-[12px] uppercase text-gri-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Arşiv tarihi
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Son sipariş
                </th>
                <th className="px-4 py-3 text-right font-semibold">Sipariş</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gri-100">
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-gri-500"
                  >
                    {statusFilter === "cold"
                      ? "Henüz arşivlenmiş müşteri yok. 90+ gün eski müşteri ortaya çıkınca cron otomatik arşivleyecek (R2_ARCHIVE_DRY_RUN=false yapıldığında)."
                      : "Bu durumda müşteri yok."}
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const meta = STATUS_META[c.archive_status];
                  return (
                    <tr
                      key={c.user_id}
                      className="border-b border-gri-100 last:border-0 hover:bg-gri-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-lacivert">
                          {c.display_name ?? "—"}
                        </div>
                        <div className="text-[12px] text-gri-500">
                          {c.email ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
                            meta.bg,
                            meta.color
                          )}
                        >
                          {meta.emoji} {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gri-700">
                        <div>{formatDate(c.archived_at)}</div>
                        <div className="text-[11.5px] text-gri-500">
                          {daysAgo(c.archived_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gri-700">
                        <div>{formatDate(c.last_order_at)}</div>
                        <div className="text-[11.5px] text-gri-500">
                          {daysAgo(c.last_order_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-lacivert">
                        {c.order_count}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/arsiv/${c.user_id}`}>
                          <Button size="sm" variant="secondary">
                            Dosyaları gör
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 text-[12.5px] text-gri-500">
        Toplam {total} müşteri · Cron <code className="rounded bg-gri-100 px-1">30 3 * * *</code> ·
        Gerçek I/O: R2_ARCHIVE_DRY_RUN env'i kontrol eder
      </div>
    </main>
  );
}
