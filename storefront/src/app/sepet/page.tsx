/**
 * Pim Etiket — /sepet
 *
 * Customer-facing sepet — `customer-cart.ts` localStorage store'undan
 * okur. /sticker ve /etiket'ten "Sepete ekle" ile gelen item'lar burada
 * görünür. /odeme'ye geçiş aynı store'u tüketir.
 *
 * Backend swap'te (Block C.3) bu sayfa server-side cart'a bağlanır.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import {
  listCustomerCart,
  removeFromCustomerCart,
  updateCustomerCartQty,
  summarizeCustomerCart,
  FREE_SHIPPING_THRESHOLD,
  type CustomerCartItem,
} from "@/lib/customer-cart";

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function SepetPage() {
  const toast = useToast();
  const [cart, setCart] = useState<CustomerCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setCart(listCustomerCart());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);
    const handler = () => refresh();
    window.addEventListener("pim_customer_cart_updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("pim_customer_cart_updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  const summary = summarizeCustomerCart();
  const subtotal = summary.subtotal;
  const shipping = summary.shipping;
  const total = summary.total;

  const updateQty = (item: CustomerCartItem, delta: number) => {
    // Sticker tier'ları 50/100/250/500/1000; etiket 1000/2000/...
    // Burada basit +/- adet — minimum item.product'a göre 50 / 1000
    const minQty = item.product === "sticker" ? 50 : 1000;
    const step = item.product === "sticker" ? 50 : 500;
    const next = Math.max(minQty, item.qty + delta * step);
    updateCustomerCartQty(item.id, next);
  };

  const remove = (id: string) => {
    removeFromCustomerCart(id);
    toast.info("Sepetten çıkarıldı");
  };

  // Hydration guard — SSR vs CSR farklı olmasın
  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-16">
        <div className="mx-auto max-w-[440px] px-6 text-center text-gri-500">
          Yükleniyor…
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-16">
        <div className="mx-auto max-w-[440px] px-6 text-center">
          <Pim pose="think" size={160} />
          <Eyebrow>Sepetin boş</Eyebrow>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight">
            Henüz bir şey eklenmemiş
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            Etiket veya sticker konfigüre etmeye başla — sepetin burada
            görünecek.
          </p>
          <div className="mt-7 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/etiket">
              <Icon.Roll size={18} /> Etiket bastır
            </Button>
            <Button variant="secondary" size="lg" href="/sticker">
              <Icon.Sticker size={18} /> Sticker bastır
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        <div className="mb-7">
          <Eyebrow>Sepetim</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {cart.length} ürün sepetinde
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          {/* CART ITEMS */}
          <div className="flex flex-col gap-3">
            {cart.map((item) => (
              <Card key={item.id} padding="p-5">
                <div className="grid grid-cols-[80px_1fr_auto] gap-4 items-start">
                  <div
                    className={`grid place-items-center w-20 h-20 rounded-lg shrink-0 ${
                      item.product === "etiket"
                        ? "bg-krem"
                        : "bg-pim-mercan-tint"
                    }`}
                  >
                    {item.product === "etiket" ? (
                      <Icon.Roll size={32} className="text-lacivert" />
                    ) : (
                      <Icon.Sticker size={32} className="text-pim-mercan" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-base truncate">
                      {item.title}
                    </div>
                    <div className="text-[13px] text-gri-700 mt-1 leading-relaxed">
                      {item.config}
                    </div>
                    {item.hediyeAdet && item.hediyeAdet > 0 && (
                      <div className="inline-flex items-center gap-1 mt-1.5 px-2 h-[22px] rounded-full bg-yesil-soft text-yesil text-[11px] font-semibold">
                        +{item.hediyeAdet} hediye sticker
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="inline-flex items-center gap-2 ring-1 ring-gri-200 rounded-full bg-white">
                        <button
                          type="button"
                          onClick={() => updateQty(item, -1)}
                          className="w-8 h-8 grid place-items-center text-gri-700 hover:bg-gri-100 rounded-l-full"
                          aria-label="Adet azalt"
                        >
                          −
                        </button>
                        <span className="text-[13px] font-semibold min-w-[60px] text-center">
                          {fmt(item.qty)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item, 1)}
                          className="w-8 h-8 grid place-items-center text-gri-700 hover:bg-gri-100 rounded-r-full"
                          aria-label="Adet artır"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[13px] text-gri-700">
                        × {item.unit.toFixed(2).replace(".", ",")} TL
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end justify-between min-h-[80px]">
                    <div className="text-xl font-bold">
                      {fmt(item.total)} TL
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="text-[13px] text-gri-500 hover:text-kirmizi font-semibold"
                    >
                      Kaldır
                    </button>
                  </div>
                </div>
              </Card>
            ))}

            {/* Continue shopping */}
            <div className="flex gap-4 mt-2">
              <Link
                href="/etiket"
                className="text-[13px] font-semibold text-pim-mercan hover:underline inline-flex items-center gap-1"
              >
                ← Etiket eklemeye devam
              </Link>
              <Link
                href="/sticker"
                className="text-[13px] font-semibold text-pim-mercan hover:underline inline-flex items-center gap-1"
              >
                ← Sticker eklemeye devam
              </Link>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="lg:sticky lg:top-20">
            <Card padding="p-6">
              <h3 className="font-semibold text-lg mb-4">Sipariş özeti</h3>
              <div className="space-y-2.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-gri-700">Ara toplam</span>
                  <span className="font-semibold">{fmt(subtotal)} TL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">Kargo</span>
                  <span className="font-semibold">
                    {shipping === 0 ? (
                      <span className="text-yesil">Ücretsiz 🎉</span>
                    ) : (
                      `${fmt(shipping)} TL`
                    )}
                  </span>
                </div>
                {shipping > 0 && (
                  <div className="text-[12.5px] text-gri-700 leading-relaxed bg-sari-soft text-[#7A560A] p-2.5 rounded-lg">
                    💡 {fmt(FREE_SHIPPING_THRESHOLD)} TL üzeri alışverişlerde
                    kargo ücretsiz — {fmt(FREE_SHIPPING_THRESHOLD - subtotal)}{" "}
                    TL kaldı.
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="font-semibold">Toplam</span>
                <span className="text-2xl font-bold">
                  {fmt(total)}{" "}
                  <span className="text-base font-semibold text-gri-700">TL</span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right mt-1">
                KDV dahil
              </div>

              <Button variant="primary" size="lg" block href="/odeme" className="mt-5">
                Ödemeye geç <Icon.ArrowR />
              </Button>
              <p className="text-[11.5px] text-gri-500 text-center mt-3 leading-relaxed">
                Ödeme sonrası 3 gün içinde tasarım dosyalarını yüklemen yeterli.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
