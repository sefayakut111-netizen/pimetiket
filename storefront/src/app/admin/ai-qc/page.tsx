/**
 * Pim Etiket — /admin/ai-qc (E.3)
 *
 * AI ön kontrolünden flag'lenen siparişlerin manuel inceleme kuyruğu.
 * customer-orders store'undan qc_flagged + operator_review statüsündeki
 * siparişleri okur. Onayla → in_production, düzeltme iste → cancelled.
 *
 * Dosya yükleme + AI flag detayları backend swap'te (Block H/I)
 * gerçek file upload + AI service ile gelir. Şu an UI iskelet.
 */

"use client";

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
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

export default function AdminAiQcPage() {
  const [items, setItems] = useState<CustomerOrder[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const refresh = () => {
    const queue = listCustomerOrders().filter(
      (o) => o.status === "qc_flagged" || o.status === "operator_review"
    );
    setItems(queue);
    setActiveIdx((i) => Math.max(0, Math.min(i, queue.length - 1)));
  };

  useEffect(() => {
    refresh();
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const decide = (action: "approve" | "reject") => {
    const order = items[activeIdx];
    if (!order) return;
    if (action === "approve") {
      updateCustomerOrderStatus(order.id, "in_production");
    } else {
      // Müşteriye düzeltme iste — proof_pending'e düşür ki müşteri tarafında
      // "düzeltme bekleniyor" görünsün. Cancelled değil çünkü iptal değil.
      updateCustomerOrderStatus(order.id, "proof_pending");
    }
    refresh();
  };

  if (items.length === 0) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="happy" size={160} />
          <h1 className="mt-4 text-[28px] font-semibold tracking-tight">
            Kuyruk temiz! 🎉
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            Tüm AI flag&rsquo;leri inceledin. Pim memnun. Yeni flag geldiğinde
            burada görünür.
          </p>
        </div>
      </main>
    );
  }

  const active = items[activeIdx];
  const product =
    active.items.length === 1
      ? active.items[0].title
      : `${active.items.length} ürün`;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <Eyebrow>AI QC kuyruğu</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Manuel kontrol kuyruğu
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {items.length} sipariş AI ön kontrolünde flag aldı, manuel
            inceleme bekliyor.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          {/* Queue list */}
          <Card padding="p-2">
            <div className="flex flex-col gap-1">
              {items.map((q, i) => {
                const flagged = q.status === "qc_flagged";
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      "text-left p-3 rounded-lg transition-colors",
                      activeIdx === i
                        ? "bg-lacivert text-white"
                        : "hover:bg-gri-100"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[12px] opacity-80">
                        {q.id}
                      </span>
                      {flagged && (
                        <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-kirmizi text-white text-[10px] font-bold">
                          FLAG
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-[13px] truncate">
                      {q.address.name}
                    </div>
                    <div
                      className={cn(
                        "text-[11.5px] mt-0.5",
                        activeIdx === i ? "text-white/70" : "text-gri-700"
                      )}
                    >
                      {q.items.length === 1
                        ? q.items[0].product === "sticker"
                          ? "Sticker"
                          : "Etiket"
                        : `${q.items.length} ürün`}{" "}
                      · {timeAgo(q.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Detail */}
          <div className="flex flex-col gap-4">
            {/* Order header */}
            <Card padding="p-6">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 font-mono">
                    {active.id}
                  </div>
                  <h2 className="text-xl font-semibold mt-1">
                    {active.address.name}
                  </h2>
                  <div className="text-[13px] text-gri-700 mt-1">
                    {product}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    Sipariş tutarı
                  </div>
                  <div className="text-xl font-bold mt-1 tabular-nums">
                    {fmt(active.total)} TL
                  </div>
                  <div className="text-[12px] text-gri-700 mt-0.5">
                    {timeAgo(active.createdAt)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Sipariş içeriği */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3">
                Sipariş içeriği
              </h3>
              <ul className="space-y-2.5 text-[13px]">
                {active.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-3 pb-2.5 border-b border-gri-100 last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lacivert truncate">
                        {item.title}
                      </span>
                      <span className="block text-[12px] text-gri-500 truncate">
                        {item.config} · ×{item.qty.toLocaleString("tr-TR")}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums shrink-0">
                      {fmt(item.total)} TL
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Preview / file placeholder */}
            <Card padding="" className="!p-0 overflow-hidden">
              <div className="aspect-[16/9] bg-gri-100 grid place-items-center">
                <div className="text-center px-6 py-12">
                  <Icon.Box size={48} className="text-gri-500 mx-auto mb-3" />
                  <div className="font-semibold text-lacivert mb-1">
                    Tasarım dosyası bekleniyor
                  </div>
                  <div className="text-[13px] text-gri-700 max-w-[400px] mx-auto leading-relaxed">
                    Müşteri henüz dosya yüklemedi ya da dosya yükleme akışı
                    backend swap&rsquo;tan sonra aktif olacak. Bu siparişe
                    ait notları aşağıdaki butonlardan yönlendir.
                  </div>
                </div>
              </div>
            </Card>

            {/* Decision buttons */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3">Operatör kararı</h3>
              <p className="text-[13px] text-gri-700 mb-4 leading-relaxed">
                Onayla → sipariş üretime alınır. Düzeltme iste → müşteriye
                prova bekleyen statüsünde döner.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => decide("approve")}
                  className="!bg-yesil hover:!bg-yesil-koyu"
                >
                  <Icon.Check size={16} /> Onayla → Üretime
                </Button>
                <Button variant="secondary" onClick={() => decide("reject")}>
                  Müşteriye düzeltme iste
                </Button>
                <Button variant="ghost">
                  <Icon.ChatBubble size={14} /> Notla iletişim
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
