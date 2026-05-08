/**
 * Pim Etiket — /siparislerim (E.2.2)
 *
 * Tüm siparişler — filtre + search + tablo/kart liste.
 * Mock data; gerçek API I adımında.
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

type Status = "kontrolde" | "uretimde" | "kargoda" | "teslim" | "iptal";

interface Order {
  id: string;
  date: string;
  title: string;
  qty: number;
  total: number;
  status: Status;
}

const ALL_ORDERS: Order[] = [
  { id: "PE-2026-1182", date: "5 May 2026", title: "Olea Doğal Sabun — etiket", qty: 2000, total: 4250, status: "kontrolde" },
  { id: "PE-2026-1175", date: "28 Nis 2026", title: "Bulutlu Roastery — sticker", qty: 500, total: 1750, status: "uretimde" },
  { id: "PE-2026-1167", date: "21 Nis 2026", title: "Atölye Niş — Holografik tabaka", qty: 250, total: 1050, status: "kargoda" },
  { id: "PE-2026-1098", date: "15 Mar 2026", title: "Olea Doğal Sabun — etiket (yenileme)", qty: 3000, total: 5800, status: "teslim" },
  { id: "PE-2026-1051", date: "28 Şub 2026", title: "Çiğdem Atölye — etiket", qty: 1500, total: 3120, status: "teslim" },
  { id: "PE-2026-0997", date: "12 Şub 2026", title: "Pop-up etkinlik — sticker", qty: 1000, total: 2900, status: "teslim" },
  { id: "PE-2026-0913", date: "20 Oca 2026", title: "İptal edilmiş test", qty: 500, total: 1500, status: "iptal" },
];

const STATUS_META: Record<
  Status,
  { label: string; color: string; bg: string }
> = {
  kontrolde: {
    label: "Kontrolde",
    color: "text-sari",
    bg: "bg-sari-soft",
  },
  uretimde: {
    label: "Üretimde",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  kargoda: {
    label: "Kargoda",
    color: "text-lacivert",
    bg: "bg-gri-100",
  },
  teslim: {
    label: "Teslim edildi",
    color: "text-yesil",
    bg: "bg-yesil-soft",
  },
  iptal: {
    label: "İptal",
    color: "text-kirmizi",
    bg: "bg-gri-100",
  },
};

const FILTER_OPTIONS: { id: Status | "tumu"; label: string }[] = [
  { id: "tumu", label: "Tümü" },
  { id: "kontrolde", label: "Kontrolde" },
  { id: "uretimde", label: "Üretimde" },
  { id: "kargoda", label: "Kargoda" },
  { id: "teslim", label: "Teslim edildi" },
  { id: "iptal", label: "İptal" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function SiparislerimPage() {
  const [filter, setFilter] = useState<Status | "tumu">("tumu");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return ALL_ORDERS.filter((o) => {
      if (filter !== "tumu" && o.status !== filter) return false;
      if (search.length > 0) {
        const q = search.toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.title.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filter, search]);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Hesabım</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Tüm siparişlerim
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {ALL_ORDERS.length} sipariş — filtreleyerek bul, tekrar sipariş
              ver veya detayı incele.
            </p>
          </div>
          <Button variant="primary" size="lg" href="/etiket">
            <Icon.Plus size={16} /> Yeni sipariş
          </Button>
        </div>

        {/* Filters */}
        <Card padding="p-4" className="mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTER_OPTIONS.map((f) => (
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
            <div className="ml-auto w-full sm:w-auto sm:min-w-[280px]">
              <div className="relative">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sipariş ID veya isim ara…"
                  className="!h-11 !pl-10"
                />
                <Icon.Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Icon.Box size={48} className="text-gri-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Sonuç bulunamadı
            </h3>
            <p className="text-base text-gri-700 mb-5">
              Filtreyi gevşetmeyi veya arama metnini değiştirmeyi dene.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setFilter("tumu");
                setSearch("");
              }}
            >
              Filtreyi sıfırla
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((o) => {
              const s = STATUS_META[o.status];
              return (
                <Card key={o.id} padding="p-5">
                  <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                          {o.id}
                        </span>
                        <span className="text-[11.5px] text-gri-500">·</span>
                        <span className="text-[11.5px] text-gri-500">
                          {o.date}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[12px] font-semibold",
                            s.bg,
                            s.color
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              s.color === "text-sari" && "bg-sari",
                              s.color === "text-pim-mercan" && "bg-pim-mercan",
                              s.color === "text-lacivert" && "bg-lacivert",
                              s.color === "text-yesil" && "bg-yesil",
                              s.color === "text-kirmizi" && "bg-kirmizi"
                            )}
                          />
                          {s.label}
                        </span>
                      </div>
                      <div className="font-semibold text-base mb-0.5 truncate">
                        {o.title}
                      </div>
                      <div className="text-[13px] text-gri-700">
                        {fmt(o.qty)} adet · {fmt(o.total)} TL
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {o.status === "teslim" && (
                        <Button variant="secondary" size="sm" href="/etiket">
                          Tekrar sipariş
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        href={`/siparis/${o.id}`}
                      >
                        Detay <Icon.ChevR size={12} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
