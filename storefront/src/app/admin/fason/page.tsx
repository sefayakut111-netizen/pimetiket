/**
 * Pim Etiket — /admin/fason (E.3)
 *
 * Fason ortakları yönetimi + sipariş atama.
 */

"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Fason {
  id: string;
  name: string;
  city: string;
  capacity: number;
  load: number;
  speciality: string[];
  rating: number;
  totalOrders: number;
}

interface PendingOrder {
  id: string;
  customer: string;
  product: string;
  qty: number;
  required: string;
}

const FASONS: Fason[] = [
  {
    id: "f1",
    name: "Bursa-1 Atölye",
    city: "Bursa / Yıldırım",
    capacity: 50000,
    load: 32000,
    speciality: ["etiket", "yaldız", "emboss"],
    rating: 4.8,
    totalOrders: 312,
  },
  {
    id: "f2",
    name: "Bursa-2 Atölye",
    city: "Bursa / Osmangazi",
    capacity: 30000,
    load: 18500,
    speciality: ["sticker", "holografik"],
    rating: 4.6,
    totalOrders: 187,
  },
  {
    id: "f3",
    name: "İstanbul-1",
    city: "İstanbul / Beylikdüzü",
    capacity: 80000,
    load: 71000,
    speciality: ["etiket", "metalik"],
    rating: 4.5,
    totalOrders: 524,
  },
  {
    id: "f4",
    name: "İzmir-1",
    city: "İzmir / Çiğli",
    capacity: 40000,
    load: 12000,
    speciality: ["sticker", "etiket"],
    rating: 4.9,
    totalOrders: 98,
  },
];

const PENDING: PendingOrder[] = [
  { id: "PE-2026-1188", customer: "Mehmet Kahveci", product: "Etiket × 2.500 Kraft + sıcak yaldız", qty: 2500, required: "yaldız" },
  { id: "PE-2026-1190", customer: "Festival Co.", product: "Sticker × 1.000 Holografik", qty: 1000, required: "holografik" },
  { id: "PE-2026-1191", customer: "Eko Atölye", product: "Etiket × 5.000 Beyaz semi-glos", qty: 5000, required: "etiket" },
];

export default function AdminFasonPage() {
  const [filter, setFilter] = useState<string>("tumu");

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6">
          <Eyebrow>Fason yönetimi</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Fason ortakları
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {FASONS.length} aktif ortak · {PENDING.length} sipariş atama bekliyor
          </p>
        </div>

        {/* Pending orders strip */}
        <Card padding="p-5" className="mb-6 !bg-sari-soft !ring-sari/30">
          <div className="flex items-center gap-3 mb-3">
            <Icon.Bolt size={18} className="text-sari" />
            <h2 className="font-semibold text-base text-[#7A560A]">
              {PENDING.length} sipariş fason ataması bekliyor
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PENDING.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-lg p-3 ring-1 ring-sari/30"
              >
                <div className="font-mono text-[11.5px] text-gri-700 mb-1">
                  {p.id}
                </div>
                <div className="font-semibold text-[13px]">{p.customer}</div>
                <div className="text-[12px] text-gri-700 mt-1 line-clamp-2">
                  {p.product}
                </div>
                <button className="mt-2 text-[12px] font-semibold text-pim-mercan hover:underline">
                  Otomatik ata →
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap mb-4">
          {[
            { id: "tumu", label: "Tümü" },
            { id: "etiket", label: "Etiket" },
            { id: "sticker", label: "Sticker" },
            { id: "yaldız", label: "Yaldız" },
            { id: "holografik", label: "Holografik" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                filter === f.id
                  ? "bg-lacivert text-white"
                  : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-gri-100"
              )}
            >
              {f.label}
            </button>
          ))}
          <Button variant="primary" size="sm" className="ml-auto">
            <Icon.Plus size={14} /> Yeni fason ekle
          </Button>
        </div>

        {/* Fason cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FASONS.filter((f) => filter === "tumu" || f.speciality.includes(filter)).map((f) => {
            const utilization = (f.load / f.capacity) * 100;
            const utilColor =
              utilization > 85
                ? "bg-kirmizi"
                : utilization > 65
                  ? "bg-sari"
                  : "bg-yesil";
            return (
              <Card key={f.id} padding="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{f.name}</h3>
                    <div className="text-[13px] text-gri-700 mt-0.5">
                      {f.city}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sari font-semibold text-[13px]">
                    <Icon.Star size={14} />
                    {f.rating}
                  </div>
                </div>

                {/* Speciality */}
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {f.speciality.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center h-[22px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold capitalize"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Capacity bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[12px] text-gri-700 mb-1.5">
                    <span>Kapasite kullanımı</span>
                    <span className="font-semibold">
                      {f.load.toLocaleString("tr-TR")} /{" "}
                      {f.capacity.toLocaleString("tr-TR")} adet
                    </span>
                  </div>
                  <div className="h-2 bg-gri-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        utilColor
                      )}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                  <div
                    className={cn(
                      "text-[11.5px] mt-1.5 font-semibold",
                      utilization > 85
                        ? "text-kirmizi"
                        : utilization > 65
                          ? "text-sari"
                          : "text-yesil"
                    )}
                  >
                    %{Math.round(utilization)} dolu
                    {utilization > 85 && " — yeni iş atama önerilmez"}
                    {utilization < 50 && " — boşta, atama uygun"}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-[12px] text-gri-700 pt-3 border-t border-gri-100">
                  <span>
                    <strong className="text-lacivert">{f.totalOrders}</strong>{" "}
                    sipariş
                  </span>
                  <span>·</span>
                  <Button variant="ghost" size="sm" className="ml-auto">
                    Detay <Icon.ChevR size={12} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
