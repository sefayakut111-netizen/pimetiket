/**
 * Pim Etiket — /admin/prova (E.3)
 *
 * Prova üretimi: müşteri tasarımını render edip onaylanacak prova oluştur.
 */

"use client";

import { useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

interface ProvaItem {
  orderId: string;
  customer: string;
  product: string;
  config: string;
  status: "to_prepare" | "ready_to_send" | "awaiting_customer" | "changes_requested";
  uploadedAt: string;
}

const PROVA: ProvaItem[] = [
  {
    orderId: "PE-2026-1186",
    customer: "Olea Sabun",
    product: "Etiket × 2.000",
    config: "Kraft + mat selefon + sıcak yaldız (altın) · 60×80mm",
    status: "to_prepare",
    uploadedAt: "8 May 13:30",
  },
  {
    orderId: "PE-2026-1184",
    customer: "Bulutlu Roastery",
    product: "Etiket × 1.500",
    config: "Beyaz semi-glos + parlak selefon · 50×70mm",
    status: "awaiting_customer",
    uploadedAt: "8 May 09:42",
  },
  {
    orderId: "PE-2026-1182",
    customer: "Olea Sabun (#2)",
    product: "Etiket × 2.000",
    config: "Kraft + mat selefon + emboss · 60×80mm",
    status: "awaiting_customer",
    uploadedAt: "7 May 19:20",
  },
  {
    orderId: "PE-2026-1179",
    customer: "Atölye Niş",
    product: "Sticker × 1.000",
    config: "Holografik + glitter · Yuvarlak 75mm",
    status: "changes_requested",
    uploadedAt: "7 May 14:18",
  },
];

const STATUS_META: Record<
  ProvaItem["status"],
  { label: string; bg: string; color: string }
> = {
  to_prepare: {
    label: "Sen hazırlayacaksın",
    bg: "bg-pim-mercan-tint",
    color: "text-pim-mercan",
  },
  ready_to_send: {
    label: "Göndermeye hazır",
    bg: "bg-yesil-soft",
    color: "text-yesil",
  },
  awaiting_customer: {
    label: "Müşteri onayı bekleniyor",
    bg: "bg-sari-soft",
    color: "text-[#7A560A]",
  },
  changes_requested: {
    label: "Değişiklik istendi",
    bg: "bg-kirmizi/10",
    color: "text-kirmizi",
  },
};

export default function AdminProvaPage() {
  const [items] = useState(PROVA);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6">
          <Eyebrow>Prova üretim</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Prova kuyruğu
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {items.length} sipariş prova aşamasında — hazırla, gönder, onay bekle.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {(
            [
              { label: "Hazırlanacak", count: 1, accent: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
              { label: "Hazır, gönderilecek", count: 0, accent: "text-yesil", bg: "bg-yesil-soft" },
              { label: "Onay bekliyor", count: 2, accent: "text-[#7A560A]", bg: "bg-sari-soft" },
              { label: "Değişiklik istendi", count: 1, accent: "text-kirmizi", bg: "bg-kirmizi/10" },
            ]
          ).map((k) => (
            <Card key={k.label} padding="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid place-items-center w-10 h-10 rounded-xl shrink-0",
                    k.bg,
                    k.accent
                  )}
                >
                  <Icon.Check size={16} />
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    {k.label}
                  </div>
                  <div className={cn("text-2xl font-bold", k.accent)}>
                    {k.count}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          {items.map((p) => {
            const s = STATUS_META[p.status];
            return (
              <Card key={p.orderId} padding="p-5">
                <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_auto] gap-4 items-start">
                  {/* Mock thumb */}
                  <div className="grid place-items-center w-20 h-20 rounded-lg bg-krem">
                    <Icon.Roll size={32} className="text-lacivert" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <span className="font-mono text-[12.5px] text-gri-700">
                        {p.orderId}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                          s.bg,
                          s.color
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="font-semibold text-base">{p.customer}</div>
                    <div className="text-[13px] text-gri-700 mt-0.5">
                      {p.product} · <span className="text-gri-500">{p.config}</span>
                    </div>
                    <div className="text-[12px] text-gri-500 mt-1">
                      Dosya yüklenme: {p.uploadedAt}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {p.status === "to_prepare" && (
                      <Button variant="primary" size="sm">
                        Prova oluştur <Icon.ArrowR size={12} />
                      </Button>
                    )}
                    {p.status === "ready_to_send" && (
                      <Button variant="primary" size="sm">
                        Müşteriye gönder
                      </Button>
                    )}
                    {p.status === "awaiting_customer" && (
                      <>
                        <Button variant="secondary" size="sm">
                          Hatırlat
                        </Button>
                        <Button variant="ghost" size="sm">
                          İptal et
                        </Button>
                      </>
                    )}
                    {p.status === "changes_requested" && (
                      <Button variant="primary" size="sm">
                        Yeni prova hazırla
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Pim helper */}
        <Card padding="p-5" className="mt-6 !bg-krem">
          <div className="flex gap-4 items-center">
            <Pim pose="inspect" size={80} bob={false} />
            <div className="flex-1">
              <h3 className="font-bold text-base mb-0.5">
                Pim ipucu: Prova kalitesi
              </h3>
              <p className="text-[13px] text-gri-700 leading-relaxed">
                Provayı PDF olarak gönderdiğinde renk kalibrasyonu için CMYK
                profilini ekle. Müşteriler genellikle ekrandaki rengi gerçek
                baskıyla aynı sanır — bu yüzden prova sayfasında uyarı kutusu
                otomatik gösterilir.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
