/**
 * /partner/siparisler — İşlerim
 */

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  PartnerAssignmentCard,
  type PartnerAssignmentRow,
} from "@/components/partner";

type ListFilter = "urgent" | "pending" | "active" | "completed" | "all";

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: "urgent", label: "Acil" },
  { id: "pending", label: "Bekleyen" },
  { id: "active", label: "Üretimde" },
  { id: "completed", label: "Tamamlanan" },
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
        <div className="p-6 pb-24">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PartnerOrdersInner />
    </Suspense>
  );
}

function PartnerOrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseFilter(searchParams.get("status"));
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
    router.push(`/partner/siparisler?status=${next}`);
  };

  return (
    <div className="p-4 md:p-6 pb-24 lg:pb-6">
      <h1 className="text-2xl font-bold text-lacivert">İşlerim</h1>
      <p className="mt-1 text-sm text-gri-700">
        Acil işler üstte — indirme ve durum güncellemeleri buradan.
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
                ? f.id === "urgent"
                  ? "bg-kirmizi text-white"
                  : "bg-lacivert text-white"
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
          <div className="rounded-2xl border border-dashed border-gri-200 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-gri-700">
              Bu filtrede iş yok
            </p>
            <Link
              href="/partner"
              className="mt-3 inline-block text-sm font-semibold text-pim-mercan hover:underline"
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
    </div>
  );
}
