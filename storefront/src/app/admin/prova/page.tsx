/**
 * Pim Etiket — /admin/prova (E.3)
 *
 * Prova üretimi: müşteri tasarımını render edip onay bekleyen siparişler.
 * customer-orders store'undan proof_pending statüsündeki siparişleri okur.
 *
 * Operatör aksiyonları:
 *   - "Üretime al" → in_production (müşteri provayı onayladı varsayımı)
 *   - "Hatırlat" → toast (gerçek SMS/email backend swap'te)
 *   - "İptal et" → cancelled
 */

"use client";

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  updateCustomerOrderStatus,
  type CustomerOrder,
} from "@/lib/customer-order";

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

export default function AdminProvaPage() {
  const toast = useToast();
  const [items, setItems] = useState<CustomerOrder[]>([]);
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>([]);

  useEffect(() => {
    const refresh = () => {
      const all = listCustomerOrders();
      setAllOrders(all);
      setItems(all.filter((o) => o.status === "proof_pending"));
    };
    refresh();
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  // KPI hesapları — admin'in genel görüşü
  const inReview = allOrders.filter(
    (o) => o.status === "operator_review"
  ).length;
  const proofPending = items.length;
  const inProduction = allOrders.filter(
    (o) => o.status === "in_production"
  ).length;
  const flagged = allOrders.filter((o) => o.status === "qc_flagged").length;

  const handleApprove = (order: CustomerOrder) => {
    updateCustomerOrderStatus(order.id, "in_production");
    toast.success(`${order.id} → Üretime alındı`);
  };

  const handleReminder = (order: CustomerOrder) => {
    toast.info(`${order.id} müşterisine hatırlatma yollandı (mock)`);
  };

  const handleCancel = (order: CustomerOrder) => {
    updateCustomerOrderStatus(order.id, "cancelled");
    toast.info(`${order.id} iptal edildi`);
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6">
          <Eyebrow>Prova üretim</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Prova kuyruğu
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {items.length === 0
              ? "Prova bekleyen sipariş yok."
              : `${items.length} sipariş müşteri onayı bekliyor.`}
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {(
            [
              {
                label: "Operatör inceliyor",
                count: inReview,
                accent: "text-pim-mercan",
                bg: "bg-pim-mercan-tint",
              },
              {
                label: "Onay bekliyor",
                count: proofPending,
                accent: "text-[#7A560A]",
                bg: "bg-sari-soft",
              },
              {
                label: "Üretimde",
                count: inProduction,
                accent: "text-yesil",
                bg: "bg-yesil-soft",
              },
              {
                label: "AI flag",
                count: flagged,
                accent: "text-kirmizi",
                bg: "bg-kirmizi/10",
              },
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
                  <div className={cn("text-2xl font-bold tabular-nums", k.accent)}>
                    {k.count}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* List */}
        {items.length === 0 ? (
          <Card padding="p-10" className="text-center">
            <Pim pose="happy" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              Prova kuyruğu temiz 🎉
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              Müşteri onayı bekleyen prova yok. Yeni siparişler operatör
              incelemesinden geçince burada görünür.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((p) => {
              const product =
                p.items.length === 1
                  ? p.items[0].title
                  : `${p.items.length} ürün`;
              const config = p.items
                .map((i) => i.config)
                .join(" · ")
                .slice(0, 100);
              const isEtiket = p.items.some((i) => i.product === "etiket");
              return (
                <Card key={p.id} padding="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_auto] gap-4 items-start">
                    {/* Thumb */}
                    <div
                      className={cn(
                        "grid place-items-center w-20 h-20 rounded-lg shrink-0",
                        isEtiket ? "bg-krem" : "bg-pim-mercan-tint"
                      )}
                    >
                      {isEtiket ? (
                        <Icon.Roll size={32} className="text-lacivert" />
                      ) : (
                        <Icon.Sticker size={32} className="text-pim-mercan" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className="font-mono text-[12.5px] text-gri-700">
                          {p.id}
                        </span>
                        <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-sari-soft text-[#7A560A] text-[11.5px] font-semibold">
                          Onay bekliyor
                        </span>
                      </div>
                      <div className="font-semibold text-base">
                        {p.address.name}
                      </div>
                      <div className="text-[13px] text-gri-700 mt-0.5">
                        {product}{" "}
                        <span className="text-gri-500">· {config}</span>
                      </div>
                      <div className="text-[12px] text-gri-500 mt-1 tabular-nums">
                        Sipariş: {timeAgo(p.createdAt)} · {fmt(p.total)} TL
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(p)}
                      >
                        <Icon.Check size={12} /> Üretime al
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReminder(p)}
                      >
                        Hatırlat
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(p)}
                      >
                        İptal et
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

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
                otomatik gösterilir. Dosya yükleme + render akışı backend
                swap&rsquo;tan sonra aktif olacak.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
