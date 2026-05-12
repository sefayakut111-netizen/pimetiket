/**
 * QuickReorderWidget — anasayfada login kullanıcının son siparişine bağlantı.
 *
 * Strateji: kullanıcı login DEĞİLSE veya hiç sipariş YOKSA hiçbir şey
 * render etmez. Tek sipariş varsa onu gösterir, birden fazlaysa en yenisini
 * gösterir ve "Tüm siparişlerim" linki sunar.
 *
 * Click → /siparis/[id] → mevcut "Yeniden bastır" akışı.
 *
 * Veri kaynağı: refreshCustomerOrders() (Supabase orders, RLS user_id).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, Button } from "@/components/ui";
import {
  refreshCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";

function lastOrderDateLabel(ts: number): string {
  const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Bugün";
  if (days === 1) return "Dün";
  if (days < 30) return `${days} gün önce`;
  if (days < 60) return "Geçen ay";
  return `${Math.floor(days / 30)} ay önce`;
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString("tr-TR") + " TL";

export function QuickReorderWidget() {
  const [lastOrder, setLastOrder] = useState<CustomerOrder | null>(null);
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    refreshCustomerOrders()
      .then((orders) => {
        if (cancelled || orders.length === 0) return;
        const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);
        setLastOrder(sorted[0]);
        setOrderCount(orders.length);
      })
      .catch(() => {
        /* anonymous user — silent skip */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!lastOrder) return null;

  const itemSummary =
    lastOrder.items.length === 1
      ? `${lastOrder.items[0].product === "sticker" ? "Sticker" : "Etiket"} · ${lastOrder.items[0].config}`
      : `${lastOrder.items.length} ürün`;

  return (
    <section className="mx-auto max-w-[1280px] px-4 md:px-8 mt-8">
      <Card padding="p-5" className="bg-pim-mercan-tint ring-pim-mercan/15">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white text-pim-mercan shrink-0">
            <Icon.Refresh size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.06em] text-pim-mercan font-bold">
              Yeniden bastır
            </div>
            <div className="text-[15px] font-semibold text-lacivert truncate mt-0.5">
              {itemSummary}
            </div>
            <div className="text-[12px] text-gri-700 mt-0.5">
              {lastOrderDateLabel(lastOrder.createdAt)} · {fmt(lastOrder.total)}
              {orderCount > 1 && (
                <>
                  {" "}
                  · {orderCount} sipariş arşivinde
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/siparis/${lastOrder.id}`}>
              <Button variant="primary" size="md">
                Detay → bastır
              </Button>
            </Link>
            {orderCount > 1 && (
              <Link href="/siparislerim">
                <Button variant="ghost" size="md">
                  Tümü
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
