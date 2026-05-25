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
import Image from "next/image";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  updateCustomerOrderStatus,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";
import { fetchAllOrdersForAdmin } from "@/lib/admin-orders";

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

// Sefa 23 May v68: /admin/prova kartlarda müşteri tasarımı thumbnail.
// design-url endpoint signed URL döner (5 dk TTL). Admin/staff bypass
// endpoint tarafında eklendi (aynı commit).
function DesignThumb({
  orderId,
  itemId,
  fallbackIsEtiket,
}: {
  orderId: string;
  itemId: string;
  fallbackIsEtiket: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/orders/${orderId}/items/${itemId}/design-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.url) setUrl(d.url);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, itemId]);

  // Tasarım var ve raster: göster. SVG / PDF olabilir, Image yine deniyor.
  if (url && !error) {
    return (
      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gri-100 shrink-0">
        <Image
          src={url}
          alt="Tasarım"
          fill
          sizes="80px"
          className="object-contain"
          unoptimized
          onError={() => setError(true)}
        />
      </div>
    );
  }
  // Fallback: tasarım yok veya yüklenemedi → tip ikonu
  return (
    <div
      className={cn(
        "grid place-items-center w-20 h-20 rounded-lg shrink-0",
        fallbackIsEtiket ? "bg-krem" : "bg-pim-mercan-tint"
      )}
    >
      {fallbackIsEtiket ? (
        <Icon.Roll size={32} className="text-lacivert" />
      ) : (
        <Icon.Sticker size={32} className="text-pim-mercan" />
      )}
    </div>
  );
}

export default function AdminProvaPage() {
  const toast = useToast();
  const [items, setItems] = useState<CustomerOrder[]>([]);
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>([]);

  useEffect(() => {
    let cancelled = false;
    const applyOrders = (all: CustomerOrder[]) => {
      if (cancelled) return;
      setAllOrders(all);
      setItems(all.filter((o) => o.status === "proof_pending"));
    };
    // İlk paint: local cache (kendi user'ı)
    applyOrders(listCustomerOrders());
    // Asıl: admin API → tüm siparişler
    void fetchAllOrdersForAdmin({ limit: 500 }).then(applyOrders);
    const refresh = () => {
      applyOrders(listCustomerOrders());
      void fetchAllOrdersForAdmin({ limit: 500 }).then(applyOrders);
    };
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("pim_customer_orders_updated", refresh);
    };
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

  // Sefa 23 May v68: updateCustomerOrderStatus kaldırıldı — auth mode'da
  // no-op olduğu için butonlar sessizce başarısız oluyordu (Sefa "tuşlar
  // çalışmıyor"). Artık POST /api/admin/orders/[id]/status çağrılıyor
  // (aynı pattern /admin/siparisler'de geçen turda uygulanmıştı).
  const callStatusApi = async (
    orderId: string,
    status: string,
    note: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Güncelleme başarısız: ${j.error ?? res.status}`);
        return false;
      }
      // Optimistic: local store'u da güncelle (page refresh tetiklesin)
      updateCustomerOrderStatus(orderId, status as OrderStatus);
      // Re-fetch admin list — useEffect listener yakalar
      window.dispatchEvent(new Event("pim_customer_orders_updated"));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "bilinmeyen hata";
      toast.error(`Ağ hatası: ${msg}`);
      return false;
    }
  };

  const handleApprove = async (order: CustomerOrder) => {
    const ok = await callStatusApi(
      order.id,
      "in_production",
      "Prova kuyruğundan üretime al (admin)"
    );
    if (ok) toast.success(`${order.id} → Üretime alındı`);
  };

  const handleReminder = (order: CustomerOrder) => {
    toast.info(`${order.id} müşterisine hatırlatma yollandı (mock)`);
  };

  const handleCancel = async (order: CustomerOrder) => {
    if (!confirm(`${order.id} siparişini iptal etmek istiyor musun?`)) return;
    const ok = await callStatusApi(
      order.id,
      "cancelled",
      "Prova kuyruğundan iptal (admin)"
    );
    if (ok) toast.info(`${order.id} iptal edildi`);
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
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
                accent: "text-sari-koyu",
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
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className="font-mono text-[12.5px] text-gri-700">
                          {p.id}
                        </span>
                        <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-sari-soft text-sari-koyu text-[11.5px] font-semibold">
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
                        Sipariş: {timeAgo(p.createdAt)} · {fmt(p.total)} ₺
                      </div>

                      {/* Sefa 23 May v68: Her order_item için thumbnail strip
                          + "Tam ekran incele" link. Tıklanınca yeni tab'da
                          /siparis/[id] açılır — admin tasarım + cutline +
                          büyük önizleme görür. */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {p.items.map((it) => (
                          <DesignThumb
                            key={it.id}
                            orderId={p.id}
                            itemId={it.id}
                            fallbackIsEtiket={it.product === "etiket"}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link
                          href={`/admin/siparisler/${p.id}`}
                          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-lacivert hover:underline"
                        >
                          Admin sipariş detayı →
                        </Link>
                        <Link
                          href={`/admin/prova/${p.id}`}
                          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-pim-mercan hover:underline"
                        >
                          Tam ekran incele (tasarım + bıçak) →
                        </Link>
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
