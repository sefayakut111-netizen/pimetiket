/**
 * Pim Etiket — /admin/siparisler (E.3)
 *
 * Tüm siparişler — tablo görünümü, filtre, search, durum güncelleme.
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

type Status = "yeni" | "ai-flag" | "operator" | "prova" | "uretim" | "kargo" | "teslim";

interface AdminOrder {
  id: string;
  customer: string;
  product: string;
  qty: number;
  total: number;
  status: Status;
  date: string;
  fason?: string;
}

const ORDERS: AdminOrder[] = [
  { id: "PE-2026-1188", customer: "Mehmet Kahveci", product: "Etiket × 2.500", qty: 2500, total: 5680, status: "ai-flag", date: "8 May 14:25" },
  { id: "PE-2026-1187", customer: "Pop-up Etk.", product: "Sticker × 500", qty: 500, total: 1750, status: "operator", date: "8 May 14:18" },
  { id: "PE-2026-1186", customer: "Olea Sabun", product: "Etiket × 2.000", qty: 2000, total: 4250, status: "uretim", date: "8 May 13:30", fason: "Bursa-1" },
  { id: "PE-2026-1185", customer: "Atölye Niş", product: "Sticker × 250", qty: 250, total: 1050, status: "kargo", date: "8 May 11:15", fason: "Bursa-2" },
  { id: "PE-2026-1184", customer: "Bulutlu Roastery", product: "Etiket × 1.500", qty: 1500, total: 3120, status: "prova", date: "8 May 09:42" },
  { id: "PE-2026-1183", customer: "Yeşil Yaprak", product: "Sticker × 1.000", qty: 1000, total: 2900, status: "yeni", date: "8 May 08:55" },
  { id: "PE-2026-1182", customer: "Olea Sabun (#2)", product: "Etiket × 2.000", qty: 2000, total: 4250, status: "prova", date: "7 May 19:20" },
  { id: "PE-2026-1181", customer: "Çiğdem Atölye", product: "Etiket × 3.000", qty: 3000, total: 5800, status: "teslim", date: "7 May 16:08", fason: "Bursa-1" },
];

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  yeni: { label: "Yeni", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  "ai-flag": { label: "AI flag", color: "text-sari", bg: "bg-sari-soft" },
  operator: { label: "Operatör", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  prova: { label: "Prova bekliyor", color: "text-lacivert", bg: "bg-gri-100" },
  uretim: { label: "Üretimde", color: "text-yesil", bg: "bg-yesil-soft" },
  kargo: { label: "Kargoda", color: "text-lacivert", bg: "bg-gri-100" },
  teslim: { label: "Teslim", color: "text-yesil", bg: "bg-yesil-soft" },
};

const FILTERS: { id: Status | "tumu"; label: string }[] = [
  { id: "tumu", label: "Tümü" },
  { id: "ai-flag", label: "AI flag (acil)" },
  { id: "operator", label: "Operatör" },
  { id: "prova", label: "Prova" },
  { id: "uretim", label: "Üretim" },
  { id: "kargo", label: "Kargo" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function AdminSiparislerPage() {
  const [filter, setFilter] = useState<Status | "tumu">("tumu");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return ORDERS.filter((o) => {
      if (filter !== "tumu" && o.status !== filter) return false;
      if (search.length > 0) {
        const q = search.toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filter, search]);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6">
          <h1 className="text-[28px] md:text-[36px] font-semibold tracking-tight">
            Sipariş yönetimi
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {ORDERS.length} aktif sipariş — filtrele ve durum güncelle
          </p>
        </div>

        {/* Filters */}
        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto w-full sm:w-auto sm:min-w-[280px] relative">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID / müşteri / ürün ara…"
                className="!h-11 !pl-10"
              />
              <Icon.Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
              />
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="border-b border-gri-200 bg-gri-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Sipariş
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Müşteri
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Ürün
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 text-right">
                  Tutar
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Durum
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Fason
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Tarih
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gri-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Icon.Box size={48} className="text-gri-500 mx-auto mb-3" />
                    <div className="font-semibold mb-1">Sonuç yok</div>
                    <div className="text-gri-700">
                      Filtreyi gevşet veya aramayı temizle.
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const s = STATUS_META[o.status];
                  return (
                    <tr key={o.id} className="hover:bg-gri-50">
                      <td className="px-4 py-3 font-mono text-[12.5px]">
                        {o.id}
                      </td>
                      <td className="px-4 py-3 font-semibold text-lacivert">
                        {o.customer}
                      </td>
                      <td className="px-4 py-3 text-gri-700">{o.product}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {fmt(o.total)} TL
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            s.bg,
                            s.color
                          )}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gri-700">
                        {o.fason ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gri-700 text-[12.5px]">
                        {o.date}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/siparis/${o.id}`}
                          className="text-pim-mercan font-semibold hover:underline"
                        >
                          Detay →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}
