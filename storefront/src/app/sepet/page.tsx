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
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import {
  listCustomerCart,
  removeFromCustomerCart,
  updateCustomerCartQty,
  summarizeCustomerCart,
  refreshCustomerCart,
  ensureAuthBindings,
  FREE_SHIPPING_THRESHOLD,
  type CustomerCartItem,
} from "@/lib/customer-cart";

const EXTRA = {
  tr: {
    toastRemoved: "Sepetten çıkarıldı",
    decreaseQty: "Adet azalt",
    increaseQty: "Adet artır",
    giftSticker: (n: number) => `+${n} hediye sticker`,
    unitPrice: (unit: string) => `× ${unit} TL`,
    currency: "TL",
    postPayHint:
      "Ödeme sonrası 3 gün içinde tasarım dosyalarını yüklemen yeterli.",
    locale: "tr-TR",
    decimal: (n: number) => n.toFixed(2).replace(".", ","),
  },
  en: {
    toastRemoved: "Removed from cart",
    decreaseQty: "Decrease quantity",
    increaseQty: "Increase quantity",
    giftSticker: (n: number) => `+${n} gift stickers`,
    unitPrice: (unit: string) => `× ${unit} TRY`,
    currency: "TRY",
    postPayHint:
      "Upload your design files within 3 days after payment — that's all.",
    locale: "en-US",
    decimal: (n: number) => n.toFixed(2),
  },
};

export default function SepetPage() {
  const toast = useToast();
  const { t, locale } = useT();
  const x = locale === "en" ? EXTRA.en : EXTRA.tr;
  const fmt = (n: number) => Math.round(n).toLocaleString(x.locale);
  const [cart, setCart] = useState<CustomerCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Sefa 16 May denetim #10: Skeleton 300ms eşiği — kısa yüklemelerde
  // skeleton flicker'ı önler. Cart genelde localStorage'dan anında gelir,
  // 300ms öncesi skeleton göstermiyoruz.
  const [showSkeleton, setShowSkeleton] = useState(false);

  const refresh = useCallback(() => {
    setCart(listCustomerCart());
  }, []);

  useEffect(() => {
    ensureAuthBindings();
    // 300ms threshold — eğer yükleme hızlı bittiyse skeleton hiç gözükmez
    const skeletonTimer = setTimeout(() => {
      if (!hydrated) setShowSkeleton(true);
    }, 300);
    void refreshCustomerCart().then(() => {
      refresh();
      setHydrated(true);
      clearTimeout(skeletonTimer);
    });
    const handler = () => refresh();
    window.addEventListener("pim_customer_cart_updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      clearTimeout(skeletonTimer);
      window.removeEventListener("pim_customer_cart_updated", handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    void updateCustomerCartQty(item.id, next);
  };

  const remove = (id: string) => {
    void removeFromCustomerCart(id);
    toast.info(x.toastRemoved);
  };

  // Hydration guard — Sefa 16 May denetim #10:
  // Skeleton sadece 300ms+ yükleme uzarsa görünür. Hızlı load'larda
  // direkt empty state veya cart render edilir (flicker yok).
  if (!hydrated) {
    if (!showSkeleton) {
      return <main className="bg-gri-50 min-h-[calc(100vh-64px)]" />;
    }
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-6 md:py-8 pb-20">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="mb-5 md:mb-7 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-48" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
            <div className="flex flex-col gap-3">
              <Skeleton.OrderRow />
              <Skeleton.OrderRow />
            </div>
            <Skeleton.Card className="lg:sticky lg:top-20" />
          </div>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-16">
        <div className="mx-auto max-w-[440px] px-6 text-center">
          <Pim pose="think" size={160} />
          <Eyebrow>Sepet</Eyebrow>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight">
            {t.cart.empty}
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            {t.cart.emptyDesc}
          </p>
          <div className="mt-7 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/etiket">
              <Icon.Roll size={18} /> {t.home.ctaEtiket}
            </Button>
            <Button variant="secondary" size="lg" href="/sticker">
              <Icon.Sticker size={18} /> {t.home.ctaSticker}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-6 md:py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-5 md:mb-7 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>{t.cart.title}</Eyebrow>
            <h1 className="mt-3 text-[24px] md:text-[36px] font-semibold tracking-tight">
              {t.cart.itemsInCart(cart.length)}
            </h1>
          </div>
          <div className="hidden md:block">
            <Pim pose="happy" size={80} bob={false} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          {/* CART ITEMS */}
          <div className="flex flex-col gap-3">
            {cart.map((item) => (
              <Card key={item.id} padding="p-4 sm:p-5">
                <div className="grid grid-cols-[60px_1fr_auto] sm:grid-cols-[80px_1fr_auto] gap-3 sm:gap-4 items-start">
                  <div
                    className={`grid place-items-center w-15 h-15 sm:w-20 sm:h-20 rounded-lg shrink-0 overflow-hidden ${
                      item.designPreviewUrl
                        ? "bg-white ring-1 ring-gri-200"
                        : item.product === "etiket"
                          ? "bg-krem"
                          : "bg-pim-mercan-tint"
                    }`}
                  >
                    {item.designPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.designPreviewUrl}
                        alt={item.designFileName ?? "Tasarım"}
                        className="w-full h-full object-contain"
                      />
                    ) : item.product === "etiket" ? (
                      <Icon.Roll size={28} className="text-lacivert" />
                    ) : (
                      <Icon.Sticker size={28} className="text-pim-mercan" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-base truncate">
                      {item.title}
                    </div>
                    <div className="text-[13px] text-gri-700 mt-1 leading-relaxed">
                      {item.config}
                    </div>
                    {item.designFileName && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <div className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full bg-yesil-soft text-yesil text-[11px] font-semibold">
                          ✓ Tasarım yüklendi
                        </div>
                        {/* Multi-design metadata (Sefa 15 May v4):
                            additionalDesigns varsa ek tasarım sayısı göster */}
                        {item.additionalDesigns &&
                          item.additionalDesigns.length > 0 && (
                            <div
                              className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold"
                              title={`Toplam ${1 + item.additionalDesigns.length} tasarım`}
                            >
                              +{item.additionalDesigns.length} tasarım
                            </div>
                          )}
                        {/* designCount alanı kullanıcı belirttiği — yüklenenden farklı olabilir */}
                        {item.designCount && item.designCount > 1 && (
                          <div
                            className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full bg-krem ring-1 ring-gri-200 text-lacivert text-[11px] font-semibold"
                            title="Toplam farklı tasarım sayısı"
                          >
                            {item.designCount} çeşit
                          </div>
                        )}
                      </div>
                    )}
                    {/* +hediye chip kaldırıldı (Sefa kuralı 11 May) —
                        overrun adet backend'de depo etiketi olarak kalır */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="inline-flex items-center gap-2 ring-1 ring-gri-200 rounded-full bg-white">
                        <button
                          type="button"
                          onClick={() => updateQty(item, -1)}
                          className="w-8 h-8 grid place-items-center text-gri-700 hover:bg-gri-100 rounded-l-full"
                          aria-label={x.decreaseQty}
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
                          aria-label={x.increaseQty}
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[13px] text-gri-700">
                        {x.unitPrice(x.decimal(item.unit))}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end justify-between min-h-[80px]">
                    <div className="text-xl font-bold">
                      {fmt(item.total)} {x.currency}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `"${item.title}" sepetten çıkarılsın mı?`
                          )
                        ) {
                          remove(item.id);
                        }
                      }}
                      aria-label={`${item.title} sepetten kaldır`}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] text-gri-500 hover:text-kirmizi hover:bg-kirmizi/5 font-semibold transition-colors"
                    >
                      <Icon.X size={13} />
                      {t.common.remove}
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
                ← {t.nav.etiket}
              </Link>
              <Link
                href="/sticker"
                className="text-[13px] font-semibold text-pim-mercan hover:underline inline-flex items-center gap-1"
              >
                ← {t.nav.sticker}
              </Link>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="lg:sticky lg:top-20">
            <Card padding="p-6">
              <h3 className="font-semibold text-lg mb-4">{t.cart.summary}</h3>
              <div className="space-y-2.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-gri-700">{t.cart.subtotal}</span>
                  <span className="font-semibold">
                    {fmt(subtotal)} {x.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">{t.cart.shipping}</span>
                  <span className="font-semibold">
                    {shipping === 0 ? (
                      <span className="text-yesil">{t.cart.free}</span>
                    ) : (
                      `${fmt(shipping)} ${x.currency}`
                    )}
                  </span>
                </div>
                {shipping > 0 && (
                  <div className="bg-sari-soft text-sari-koyu p-3 rounded-lg">
                    <div className="text-[12.5px] leading-relaxed font-semibold mb-1.5">
                      🚚{" "}
                      {t.cart.freeShippingHint(
                        fmt(FREE_SHIPPING_THRESHOLD - subtotal)
                      )}
                    </div>
                    <div
                      className="h-1.5 rounded-full bg-white/60 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.min(
                        100,
                        Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)
                      )}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Kargo bedava eşiğine ilerleme"
                    >
                      <div
                        className="h-full bg-sari rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10.5px] tabular-nums">
                      <span>{fmt(subtotal)} TL</span>
                      <span>{fmt(FREE_SHIPPING_THRESHOLD)} TL</span>
                    </div>
                  </div>
                )}
                {shipping === 0 && subtotal > 0 && (
                  <div className="bg-yesil-soft text-yesil p-2.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5">
                    🎉 Kargo bedava — eşiği geçtin!
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="font-semibold">{t.cart.total}</span>
                <span className="text-2xl font-bold">
                  {fmt(total)}{" "}
                  <span className="text-base font-semibold text-gri-700">
                    {x.currency}
                  </span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right mt-1">
                {t.cart.vatIncluded}
              </div>

              <Button variant="primary" size="lg" block href="/odeme" className="mt-5">
                {t.cart.proceedToCheckout} <Icon.ArrowR />
              </Button>
              <p className="text-[11.5px] text-gri-500 text-center mt-3 leading-relaxed">
                {x.postPayHint}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
