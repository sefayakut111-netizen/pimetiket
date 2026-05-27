/**
 * Pim Etiket — /partner (Sefa 23 May v68 — Partner P2)
 *
 * Dashboard ana sayfa:
 *   - Üst durum bar (bekleyen + üretimde + sorun)
 *   - 4 istatistik kartı (bekleyen / üretimde / bu ay shipped / iptal)
 *   - Üretim özeti (kalem adet + ürün mix)
 *   - Acil sıradakiler listesi (5 max)
 *
 * Auth: middleware /partner/* için role='partner' garantili.
 * Bu sayfa client component (fetch + live update yeteneği).
 *
 * Sefa kuralı: partner mali bilgi GÖRMEZ. ₺ hiçbir yerde gösterilmez.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Eyebrow, Skeleton, useToast } from "@/components/ui";
import {
  PartnerAssignmentCard,
  type PartnerAssignmentRow,
} from "@/components/partner";

interface DashboardPayload {
  stats: {
    pending_review: number;
    in_production: number;
    completed_this_month: number;
    cancelled_this_month: number;
    issue_open: number;
  };
  production_summary: {
    items_count: number;
    orders_count: number;
    product_breakdown: { product_type: string; percent: number }[];
  };
  urgent_queue: PartnerAssignmentRow[];
}

const PRODUCT_LABEL: Record<string, string> = {
  sticker: "Sticker",
  etiket_rulo: "Etiket Rulo",
  etiket_tabaka: "Etiket Tabaka",
};

export default function PartnerDashboardPage() {
  const toast = useToast();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/dashboard", { cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as DashboardPayload;
      setData(j);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error("Dashboard yüklenemedi: " + msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="container py-8">
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container py-12 text-center">
        <p className="text-sm text-gri-700">Veriler yüklenemedi.</p>
      </main>
    );
  }

  const { stats, production_summary, urgent_queue } = data;

  return (
    <main className="container py-8 pb-16">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Eyebrow>PARTNER PANELİ</Eyebrow>
          <h1 className="mt-2 text-2xl font-bold text-lacivert">
            Bugünkü Sipariş Durumu
          </h1>
          <p className="mt-1 text-sm text-gri-700">
            Sana atanan siparişleri, bekleyen onayları ve aylık üretim
            performansını buradan takip et.
          </p>
        </div>
        <Pim pose="happy" size={56} />
      </div>

      <div className="mb-6 rounded-2xl border border-pim-mercan/30 bg-pim-mercan-tint/30 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link
            href="/partner/siparisler?filter=pending"
            className="font-semibold text-lacivert hover:text-pim-mercan"
          >
            BEKLEYEN ONAY:{" "}
            <span className="text-pim-mercan">{stats.pending_review}</span>{" "}
            sipariş
          </Link>
          <Link
            href="/partner/siparisler?filter=active"
            className="text-gri-700 hover:text-lacivert"
          >
            ÜRETİMDE:{" "}
            <span className="font-semibold text-lacivert">
              {stats.in_production}
            </span>
          </Link>
          {stats.issue_open > 0 && (
            <Link
              href="/partner/siparisler?filter=issue"
              className="font-semibold text-kirmizi hover:underline"
            >
              AÇIK SORUN: {stats.issue_open}
            </Link>
          )}
        </div>
      </div>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bekleyen Onay"
          value={stats.pending_review}
          accent="mercan"
          hint="Henüz kabul etmediğin"
          href="/partner/siparisler?filter=pending"
        />
        <StatCard
          label="Üretimde"
          value={stats.in_production}
          accent="lacivert"
          hint="Şu an üretim hattında"
          href="/partner/siparisler?filter=active"
        />
        <StatCard
          label="Bu Ay Tamamlanan"
          value={stats.completed_this_month}
          accent="yesil"
          hint="Kargoya verilen sipariş"
          href="/partner/siparisler?filter=completed"
        />
        <StatCard
          label="Bu Ay İptal"
          value={stats.cancelled_this_month}
          accent="gri"
          hint="İptal edilen sipariş"
          href="/partner/siparisler?filter=all"
        />
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gri-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gri-700">
            Bu Ay Üretim Hacmin
          </h3>
          <p className="mt-2 text-3xl font-bold text-lacivert">
            {production_summary.items_count.toLocaleString("tr-TR")}{" "}
            <span className="text-base text-gri-700">adet</span>
          </p>
          <p className="mt-1 text-sm text-gri-700">
            {production_summary.orders_count} sipariş tamamlandı
          </p>
        </div>

        <div className="rounded-2xl border border-gri-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gri-700">Ürün Dağılımı</h3>
          {production_summary.product_breakdown.length === 0 ? (
            <p className="mt-3 text-sm text-gri-500">
              Henüz bu ay tamamlanan sipariş yok.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {production_summary.product_breakdown.map((p) => (
                <div key={p.product_type}>
                  <div className="flex justify-between text-xs text-gri-700">
                    <span>{PRODUCT_LABEL[p.product_type] ?? p.product_type}</span>
                    <span className="font-semibold">%{p.percent}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded bg-gri-100">
                    <div
                      className="h-full bg-pim-mercan"
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-lacivert">Acil Sıradakiler</h2>
          <Link
            href="/partner/siparisler"
            className="text-sm font-semibold text-pim-mercan hover:underline"
          >
            Tümünü gör →
          </Link>
        </div>

        {urgent_queue.length === 0 ? (
          <div className="rounded-2xl border border-gri-200 bg-white p-8 text-center">
            <p className="text-sm text-gri-700">
              Şu an bekleyen aktif siparişin yok.
            </p>
            <Link
              href="/partner/siparisler"
              className="mt-3 inline-block text-sm font-semibold text-pim-mercan hover:underline"
            >
              Tüm siparişleri gör
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {urgent_queue.map((row) => (
              <PartnerAssignmentCard
                key={row.assignment_id}
                row={row}
                onRefresh={() => void load()}
                onError={(msg) => toast.error(msg)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  accent: "mercan" | "lacivert" | "yesil" | "gri";
  hint: string;
  href: string;
}

function StatCard({ label, value, accent, hint, href }: StatCardProps) {
  const accentColor =
    accent === "mercan"
      ? "text-pim-mercan"
      : accent === "yesil"
        ? "text-yesil"
        : accent === "gri"
          ? "text-gri-700"
          : "text-lacivert";
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gri-200 bg-white p-5 shadow-sm transition-colors hover:border-pim-mercan/40 hover:shadow-md"
    >
      <p className="text-xs uppercase tracking-wide text-gri-700">{label}</p>
      <p className={`mt-2 text-4xl font-bold ${accentColor}`}>{value}</p>
      <p className="mt-2 text-[11px] text-gri-500">{hint}</p>
    </Link>
  );
}
