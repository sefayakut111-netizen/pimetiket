/**
 * Pim Etiket — /partner/siparisler
 *
 * Partner atama listesi — filtre sekmeleri + indirme + durum güncelleme.
 */

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eyebrow, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  PartnerAssignmentCard,
  type PartnerAssignmentRow,
} from "@/components/partner";

type ListFilter = "active" | "pending" | "completed" | "issue" | "all";

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "active", label: "Aktif" },
  { id: "pending", label: "Bekleyen" },
  { id: "completed", label: "Tamamlanan" },
  { id: "issue", label: "Sorunlu" },
  { id: "all", label: "Tümü" },
];

function parseFilter(raw: string | null): ListFilter {
  if (FILTERS.some((f) => f.id === raw)) return raw as ListFilter;
  return "active";
}

export default function PartnerOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="container py-8">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </main>
      }
    >
      <PartnerOrdersInner />
    </Suspense>
  );
}

function PartnerOrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseFilter(searchParams.get("filter"));
  const toast = useToast();
  const [rows, setRows] = useState<PartnerAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/partner/orders?status=${encodeURIComponent(filter)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        assignments?: PartnerAssignmentRow[];
        total?: number;
      };
      setRows(json.assignments ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Sipariş listesi yüklenemedi");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = (next: ListFilter) => {
    router.push(`/partner/siparisler?filter=${next}`);
  };

  return (
    <main className="container py-8 pb-16">
      <Eyebrow>PARTNER PANELİ</Eyebrow>
      <h1 className="mt-2 text-2xl font-bold text-lacivert">Siparişlerim</h1>
      <p className="mt-1 text-sm text-gri-700">
        Atanan işler, üretim dosyaları ve durum güncellemeleri.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-[12.5px] font-semibold transition-colors",
              filter === f.id
                ? "bg-lacivert text-white"
                : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-lacivert"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[12px] text-gri-500 tabular-nums">
          {total} kayıt
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {loading &&
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full" />)}

        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gri-200 bg-gri-50/50 p-10 text-center">
            <p className="text-sm font-semibold text-gri-700">
              Bu filtrede sipariş yok
            </p>
            <p className="mt-1 text-[13px] text-gri-500">
              Yeni atamalar geldiğinde burada listelenir.
            </p>
            <Link
              href="/partner"
              className="mt-4 inline-block text-sm font-semibold text-pim-mercan hover:underline"
            >
              ← Özet sayfasına dön
            </Link>
          </div>
        )}

        {!loading &&
          rows.map((row) => (
            <PartnerAssignmentCard
              key={row.assignment_id}
              row={row}
              onRefresh={() => void load()}
              onError={(msg) => toast.error(msg)}
            />
          ))}
      </div>
    </main>
  );
}
