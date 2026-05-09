/**
 * Pim Etiket — /siparis/[id] (E.2.2)
 *
 * Sipariş detayı dynamic route. Statü timeline + dosya yükleme +
 * prova onay + ürün özeti + adres + ödeme + kargo takip.
 *
 * Mock data — gerçek bağlantı I adımında.
 */

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, StageDot } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getCustomerOrder,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

const PHASES = [
  { id: "konfigure", label: "Konfigüre" },
  { id: "odeme", label: "Ödendi" },
  { id: "dosya", label: "Dosya yüklendi" },
  { id: "ai", label: "AI kontrol" },
  { id: "operator", label: "Operatör onayı" },
  { id: "prova", label: "Prova bekleniyor" },
  { id: "uretim", label: "Üretimde" },
  { id: "kargo", label: "Kargoda" },
  { id: "teslim", label: "Teslim edildi" },
] as const;

/** OrderStatus → PHASES index map */
function statusToPhaseIndex(status: OrderStatus): number {
  switch (status) {
    case "paid":
      return 1; // Ödendi
    case "qc_pending":
      return 3; // AI kontrol
    case "qc_flagged":
    case "operator_review":
      return 4; // Operatör onayı
    case "proof_pending":
      return 5; // Prova bekleniyor
    case "in_production":
      return 6; // Üretimde
    case "shipped":
      return 7; // Kargoda
    case "delivered":
      return 8; // Teslim edildi
    default:
      return 1;
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

const INVOICE_LABEL: Record<"individual" | "corporate", string> = {
  individual: "Bireysel (e-arşiv)",
  corporate: "Kurumsal (e-fatura)",
};

const PAYMENT_METHOD_LABEL: Record<"card" | "wallet" | "transfer", string> = {
  card: "Kredi kartı",
  wallet: "Cüzdan bakiyesi",
  transfer: "Havale / EFT",
};

export default function SiparisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [proofApproved, setProofApproved] = useState(false);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOrder(getCustomerOrder(id));
    setHydrated(true);
  }, [id]);

  // Hydration guard
  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[680px] px-6 text-center text-gri-500">
          Yükleniyor…
        </div>
      </main>
    );
  }

  // Order not found
  if (!order) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[560px] px-6 text-center">
          <Pim pose="think" size={140} />
          <h1 className="mt-3 text-[26px] md:text-[32px] font-semibold tracking-tight">
            Sipariş bulunamadı
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            <strong className="font-mono">{id}</strong> numaralı sipariş bu
            cihazda kayıtlı değil. Başka bir cihazdan bakmış olabilirsin.
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/siparislerim">
              Siparişlerime dön
            </Button>
            <Button variant="secondary" size="lg" href="/etiket">
              Yeni sipariş
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Header için title üret — tek item ise onun başlığı, çoksa özet
  const title =
    order.items.length === 1
      ? order.items[0].title
      : `${order.items.length} ürünlük sipariş`;

  const orderDate = new Date(order.createdAtIso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const deliveryDate = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  const phaseIdx = statusToPhaseIndex(order.status);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-5">
          <Link
            href="/panelim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Panelim
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <Link
            href="/siparislerim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Siparişlerim
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">{id}</span>
        </div>

        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Sipariş</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-[13px] text-gri-700 flex-wrap">
              <span className="font-semibold uppercase tracking-[0.04em] font-mono">
                {order.id}
              </span>
              <span>·</span>
              <span>Sipariş tarihi: {orderDate}</span>
              <span>·</span>
              <span>
                Tahmini teslim:{" "}
                <strong className="text-lacivert">{deliveryDate}</strong>
              </span>
            </div>
          </div>
          <Button variant="secondary" href="/etiket">
            <Icon.Bolt size={14} /> Tekrar sipariş
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Vertical timeline */}
            <Card padding="p-6">
              <h2 className="text-xl font-semibold mb-5">Sipariş yolculuğu</h2>
              <ol className="flex flex-col gap-0">
                {PHASES.map((p, i) => {
                  const state =
                    i < phaseIdx ? "done" : i === phaseIdx ? "curr" : "todo";
                  return (
                    <li
                      key={p.id}
                      className="flex gap-4 relative pb-5 last:pb-0"
                    >
                      {/* Vertical line */}
                      {i < PHASES.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[13px] top-8 bottom-0 w-0.5"
                          style={{
                            background:
                              i < phaseIdx
                                ? "var(--color-yesil)"
                                : "var(--color-gri-200)",
                          }}
                        />
                      )}
                      <StageDot
                        state={state}
                        label={state === "curr" ? i + 1 : i + 1}
                      />
                      <div className="flex-1 pt-0.5">
                        <div
                          className={cn(
                            "font-semibold text-[15px]",
                            state === "todo" && "text-gri-500"
                          )}
                        >
                          {p.label}
                        </div>
                        {state === "curr" && (
                          <div className="text-[13px] text-gri-700 mt-0.5">
                            Sıradaki adım — Pim sana ne yapacağını söylüyor.
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* Proof card — current phase'e göre */}
            {phaseIdx === 5 && !proofApproved && (
              <div className="rounded-2xl p-6 bg-gradient-to-br from-pim-mercan-tint to-krem-soft ring-1 ring-pim-mercan-soft">
                <div className="flex gap-4 items-start">
                  <PimMini pose="inspect" size={56} />
                  <div className="flex-1">
                    <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan">
                      Aksiyon gerekli
                    </div>
                    <h3 className="font-semibold text-xl mt-1.5">
                      Provanı incele ve onayla
                    </h3>
                    <p className="text-base text-gri-700 mt-2 leading-relaxed">
                      AI ön kontrolünden geçti, operatörümüz baktı —
                      tasarımının matbaa öncesi nasıl görüneceğini hazırladık.
                      Onayladığında üretime giriyor.
                    </p>
                    <div className="mt-4 flex gap-2 flex-wrap">
                      <Button
                        variant="primary"
                        onClick={() => setProofApproved(true)}
                      >
                        <Icon.Check size={14} /> Provayı onayla
                      </Button>
                      <Button variant="secondary">Değişiklik iste</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {proofApproved && (
              <div className="rounded-2xl p-6 bg-yesil-soft ring-1 ring-yesil/30 flex gap-4 items-center">
                <div className="grid place-items-center w-12 h-12 rounded-full bg-yesil text-white shrink-0">
                  <Icon.Check size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base">
                    Prova onayın alındı 🎉
                  </h3>
                  <p className="text-[13px] text-gri-700 mt-0.5">
                    Sipariş üretime gönderildi. Yaklaşık 5 gün içinde kargoya
                    verilir.
                  </p>
                </div>
              </div>
            )}

            {/* File upload card — gerçek upload H adımında */}
            <Card padding="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Tasarım dosyası</h2>
                <Button variant="primary" size="sm" disabled>
                  <Icon.Plus size={14} /> Dosya yükle
                </Button>
              </div>
              <div className="rounded-lg bg-gri-50 ring-1 ring-dashed ring-gri-200 p-6 text-center text-[13px] text-gri-700 leading-relaxed">
                Dosya yükleme akışı yakında — şimdilik
                <strong className="text-lacivert"> destek@pimetiket.com</strong>{" "}
                üzerinden tasarımlarını gönderebilirsin. AI ön kontrolden geçer,
                sonra üretim hattına alınır.
              </div>
            </Card>
          </div>

          {/* SIDE — özet bilgileri */}
          <div className="flex flex-col gap-4">
            {/* Order summary */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-4">Sipariş özeti</h3>
              <ul className="flex flex-col gap-3 text-[13px]">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="pb-3 border-b border-gri-100 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between gap-3 items-baseline">
                      <span className="font-semibold text-lacivert text-[13.5px] truncate flex-1 min-w-0">
                        {item.title}
                      </span>
                      <span className="font-semibold tabular-nums shrink-0">
                        {fmt(item.total)} TL
                      </span>
                    </div>
                    <div className="text-[12px] text-gri-500 mt-1 leading-relaxed">
                      {item.config}
                    </div>
                    <div className="text-[12px] text-gri-700 mt-1 tabular-nums">
                      {item.qty.toLocaleString("tr-TR")} adet ×{" "}
                      {fmtUnit(item.unit)} TL
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-gri-200 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gri-700">Ara toplam</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(order.subtotal)} TL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">Kargo</span>
                  <span className="font-semibold tabular-nums">
                    {order.shipping === 0 ? (
                      <span className="text-yesil">Ücretsiz</span>
                    ) : (
                      `${fmt(order.shipping)} TL`
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                  TOPLAM
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt(order.total)}{" "}
                  <span className="text-base text-gri-700">TL</span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right mt-1">
                KDV dahil
              </div>
            </Card>

            {/* Shipping */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Truck size={16} /> Teslimat
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                {order.address.label && (
                  <div className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold mb-1">
                    {order.address.label}
                  </div>
                )}
                <div className="font-semibold text-lacivert">
                  {order.address.name}
                </div>
                <div>{order.address.addr}</div>
                <div>{order.address.city}</div>
                <div>{order.address.phone}</div>
              </div>
            </Card>

            {/* Payment */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Wallet size={16} /> Ödeme
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                <div>{PAYMENT_METHOD_LABEL[order.payment.method]}</div>
                {order.payment.masked && (
                  <div className="font-mono">{order.payment.masked}</div>
                )}
                <div className="text-[11.5px] text-gri-500 mt-2">
                  Fatura: {INVOICE_LABEL[order.invoice.type]}
                </div>
              </div>
            </Card>

            {/* Pim help */}
            <Card padding="p-5" className="!bg-krem">
              <div className="flex gap-3 items-center">
                <Pim pose="chat" size={64} bob={false} />
                <div>
                  <div className="font-bold text-sm">Pim&rsquo;e sor</div>
                  <div className="text-[11.5px] text-gri-700 mt-0.5">
                    Bu sipariş hakkında soru?
                  </div>
                  <button className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline">
                    Sohbeti aç →
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
