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
import { DesignThumb } from "@/components/cart/DesignThumb";
import { useT } from "@/lib/i18n/context";
import {
  listCustomerCart,
  removeFromCustomerCart,
  updateCustomerCartQty,
  addToCustomerCart,
  summarizeCustomerCart,
  refreshCustomerCart,
  ensureAuthBindings,
  FREE_SHIPPING_THRESHOLD,
  type CustomerCartItem,
} from "@/lib/customer-cart";
import { setEditIntent } from "@/lib/cart-edit-intent";
import { useRouter } from "next/navigation";
import {
  STICKER_MIN_QTY,
  STICKER_QTY_STEP,
} from "@/lib/sticker-customer-pricing";
import {
  ETIKET_MIN_QTY,
  ETIKET_QTY_STEP,
} from "@/lib/etiket-customer-pricing";

const EXTRA = {
  tr: {
    toastRemoved: "Sepetten çıkarıldı",
    toastUndo: "Geri al",
    decreaseQty: "Adet azalt",
    increaseQty: "Adet artır",
    giftSticker: (n: number) => `+${n} hediye sticker`,
    unitPrice: (unit: string) => `× ${unit} ₺`,
    unitLabel: "Birim",
    currency: "₺",
    postPayHint:
      "Ödeme sonrası 3 gün içinde tasarım dosyalarını yüklemen yeterli.",
    locale: "tr-TR",
    // Sefa 19 May v68 (UX agent P1 #12): birim fiyat HER ZAMAN 2 basamak.
    // Eski: smart precision (2 ya da 4) — sticker konfigüratöründe 2'ye
    // sabitlendi ama sepete inmemişti, "0,2510" gibi 4-basamak görünüm
    // güven kırıcıydı. Tutarsızlık giderildi.
    decimal: (n: number) => n.toFixed(2).replace(".", ","),
    // Sefa 20 May v68 (UX uzman paket B):
    howItWorksTitle: "Nasıl çalışır?",
    steps: [
      { n: "1", label: "Sipariş ver" },
      { n: "2", label: "Tasarım yükle (3 gün)" },
      { n: "3", label: "Onayla" },
      { n: "4", label: "Üret + Kargola" },
    ],
    editLink: "Düzenle",
    continueShoppingLabel: "Alışverişe devam:",
    subtotalNoVat: "Ara toplam (KDV hariç)",
    vatLabel: "KDV (%20)",
    estDelivery: "Tahmini teslimat",
    deliveryDays: {
      sticker: "3-5 iş günü",
      etiket: "5-7 iş günü",
    } as Record<"sticker" | "etiket", string>,
    // Sefa 20 May v68 (test geri bildirim #9): metin onay tarihi vurgusu
    deliveryNote:
      "Tasarım onay tarihiniz baz alınarak güncelleme yapılacaktır.",
    shippingFreeFull: (curr: string, threshold: string) =>
      `Kargo bedava (${curr}/${threshold} ₺)`,
    mobileCheckoutTotal: "Toplam",
  },
  en: {
    toastRemoved: "Removed from cart",
    toastUndo: "Undo",
    decreaseQty: "Decrease quantity",
    increaseQty: "Increase quantity",
    giftSticker: (n: number) => `+${n} gift stickers`,
    unitPrice: (unit: string) => `× ${unit} TRY`,
    unitLabel: "Unit",
    currency: "TRY",
    postPayHint:
      "Upload your design files within 3 days after payment — that's all.",
    locale: "en-US",
    decimal: (n: number) => n.toFixed(2),
    howItWorksTitle: "How it works",
    steps: [
      { n: "1", label: "Place order" },
      { n: "2", label: "Upload design (3 days)" },
      { n: "3", label: "Approve" },
      { n: "4", label: "Print + Ship" },
    ],
    editLink: "Edit",
    continueShoppingLabel: "Keep shopping:",
    subtotalNoVat: "Subtotal (VAT excl.)",
    vatLabel: "VAT (20%)",
    estDelivery: "Est. delivery",
    deliveryDays: {
      sticker: "3-5 business days",
      etiket: "5-7 business days",
    } as Record<"sticker" | "etiket", string>,
    deliveryNote: "Ships within this window if you upload the design on time.",
    shippingFreeFull: (curr: string, threshold: string) =>
      `Free shipping (${curr}/${threshold} TRY)`,
    mobileCheckoutTotal: "Total",
  },
};

// Sefa 20 May v68 UX paket B Madde #9: KDV kırılımı.
// Birim fiyatlar zaten KDV dahil → çıkar.
const VAT_RATE = 0.2;

/**
 * Config string'ini chip'lere böl + gürültüleri filtrele.
 *
 * Sefa 20 May v68 (test geri bildirim #6): Sarım yönü, göbek çapı ve
 * rulodaki adet bilgisi fiyata etken DEĞİL, sadece üretim teknik bilgisi.
 * Sepette gösterilmesin — kullanıcı sadece fiyatlandırma kalemlerini görsün.
 * Bu bilgiler sipariş detayında ve üretim partnerinde tam görünür.
 */
function parseConfigChips(config: string): string[] {
  return config
    .split(/\s·\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // "Özelleştirme yok" negatif bilgi — gürültü, gizle
    .filter((s) => !/özelleştirme\s*yok/i.test(s))
    // Sefa 20 May v68 #6: Sarım/Göbek/rulodaki adet fiyata etken değil
    .filter((s) => !/^sarım\s/i.test(s))
    .filter((s) => !/göbek/i.test(s))
    .filter((s) => !/adet\/rulo/i.test(s));
}

export default function SepetPage() {
  const toast = useToast();
  const router = useRouter();
  const { t, locale } = useT();
  const x = locale === "en" ? EXTRA.en : EXTRA.tr;
  const fmt = (n: number) => Math.round(n).toLocaleString(x.locale);

  // Sefa 20 May v68 test #3: Düzenle pattern — item snapshot localStorage'a
  // yaz, konfigüratöre yönlendir. Konfigüratör mount'ta loadEditIntent ile
  // state'i geri yükler.
  const handleEdit = (item: CustomerCartItem) => {
    setEditIntent(item);
    const target =
      item.product === "etiket" ? "/etiket/yapilandir" : "/sticker/yapilandir";
    router.push(target);
  };
  const [cart, setCart] = useState<CustomerCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Sefa 18 May v68 Migration 053: min/max sipariş tutarı limit
  const [minOrderTotal, setMinOrderTotal] = useState<number>(0);
  const [maxOrderTotal, setMaxOrderTotal] = useState<number>(0);
  // Sefa 16 May denetim #10: Skeleton 300ms eşiği — kısa yüklemelerde
  // skeleton flicker'ı önler. Cart genelde localStorage'dan anında gelir,
  // 300ms öncesi skeleton göstermiyoruz.
  const [showSkeleton, setShowSkeleton] = useState(false);

  const refresh = useCallback(() => {
    setCart(listCustomerCart());
  }, []);

  useEffect(() => {
    ensureAuthBindings();
    // Sefa 16 May UX denetim P2-1:
    //   1) localStorage'dan ilk render — anında görselleştir
    //   2) Cart boşsa hydrated=true → skeleton hiç gözükmez,
    //      direkt empty state. Auditer "3 sn skeleton sonra empty"
    //      şikayetini çözer.
    //   3) Cart doluysa hydrated=true → kart anında render olur,
    //      arka planda Supabase ile freshen olunur.
    //   4) Sadece "auth'ı yeni yenileme" gibi kenar senaryoda
    //      300ms eşik + skeleton.
    refresh();
    // Site settings (min/max sepet) fetch — public GET endpoint
    void fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.settings) {
          setMinOrderTotal(Number(json.settings.min_order_total_try ?? 0));
          setMaxOrderTotal(Number(json.settings.max_order_total_try ?? 0));
        }
      })
      .catch(() => {
        /* silent — limit kontrol opsiyonel */
      });
    const initialCount = summarizeCustomerCart().itemCount;
    if (initialCount === 0) {
      // localStorage boş — empty state'i direkt göster, fetch arka planda
      setHydrated(true);
    }
    const skeletonTimer = setTimeout(() => {
      if (!hydrated && initialCount === 0) setShowSkeleton(true);
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
    // Sefa 19 May v68 (UX agent P1 #11): step + min konfigüratörle hizalandı.
    // Eski: sticker 50/50 (konfigüratör 25/25 → tier mismatch + fiyat
    // yeniden hesabı kırılgan). Yeni: aynı constants kullan.
    const minQty = item.product === "sticker" ? STICKER_MIN_QTY : ETIKET_MIN_QTY;
    const step = item.product === "sticker" ? STICKER_QTY_STEP : ETIKET_QTY_STEP;
    const next = Math.max(minQty, item.qty + delta * step);
    void updateCustomerCartQty(item.id, next);
  };

  // Sefa 20 May v68 UX paket C #5: Modal confirm yerine undo snackbar.
  // Item kaldırılır, toast'ta "Geri al" 5 sn aktif kalır; tıklanırsa
  // item tekrar eklenir (id ve addedAt yeni, ama aynı config).
  const remove = (item: CustomerCartItem) => {
    void removeFromCustomerCart(item.id);
    toast.undoable(`${item.title} ${x.toastRemoved.toLowerCase()}`, () => {
      // Item'ı yeniden ekle — id ve addedAt yeniden üretilir
      const { id: _id, addedAt: _addedAt, ...rest } = item;
      void _id; void _addedAt;
      void addToCustomerCart(rest);
    });
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
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-6 md:py-8 pb-32 lg:pb-20">
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

        {/* Sefa 20 May v68 (test geri bildirim #2): "Nasıl çalışır" info-box
            kaldırıldı — sepette gereksiz alan kaplıyordu. */}

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          {/* CART ITEMS */}
          <div className="flex flex-col gap-3">
            {cart.map((item) => (
              <Card key={item.id} padding="p-4 sm:p-5">
                <div className="grid grid-cols-[60px_1fr_auto] sm:grid-cols-[80px_1fr_auto] gap-3 sm:gap-4 items-start">
                  {/* Sefa 20 May v68 Migration 072: DesignThumb 3 öncelikli:
                      1) preview render → asıl tasarım
                      2) MIME varsa → PDF/AI/PSD rozeti
                      3) fallback → ürün ikonu */}
                  <DesignThumb
                    previewUrl={item.designPreviewUrl}
                    fileName={item.designFileName}
                    mimeType={item.designMimeType}
                    product={item.product}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-base truncate">
                      {item.title}
                    </div>
                    {/* Sefa 20 May v68 UX paket B Madde #4: Config artık chip
                        listesi — taranabilir; "Özelleştirme yok" gibi negatif
                        gürültü filtrelendi (parseConfigChips). */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {parseConfigChips(item.config).map((chunk, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11.5px] text-gri-700 bg-gri-100 leading-tight tabular-nums"
                        >
                          {chunk}
                        </span>
                      ))}
                    </div>
                    {item.designFileName && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <div className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full bg-yesil-soft text-yesil text-[11px] font-semibold">
                          ✓ Tasarım yüklendi
                        </div>
                        {item.additionalDesigns &&
                          item.additionalDesigns.length > 0 && (
                            <div
                              className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold"
                              title={`Toplam ${1 + item.additionalDesigns.length} tasarım`}
                            >
                              +{item.additionalDesigns.length} tasarım
                            </div>
                          )}
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
                    {/* Sefa 20 May v68 (test geri bildirim): Sepette adet
                        stepper [- 1000 +] kaldırıldı — tier'a göre iskonto
                        uygulanıyor, sepette linear hesap yanıltıcı. Adet
                        değişikliği "Düzenle" ile konfigüratörde yapılır.
                        Salt okunur "Adet: X · Birim: Y" etiketi kaldı. */}
                    <div className="flex items-center gap-3 mt-3 flex-wrap text-[12.5px] tabular-nums">
                      <span>
                        <span className="text-gri-500">Adet:</span>{" "}
                        <strong className="text-lacivert">{fmt(item.qty)}</strong>
                      </span>
                      <span className="text-gri-300" aria-hidden="true">·</span>
                      <span>
                        <span className="text-gri-500">{x.unitLabel}:</span>{" "}
                        <strong className="text-lacivert">{x.decimal(item.unit)} {x.currency}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end justify-between min-h-[80px]">
                    <div>
                      {/* Sefa-3 + 20 May test #5: Toplam büyük + altta
                          "X ₺ × Y adet" net birimli hesap (önceden "3,64 × 100"
                          → "3,64 ₺ × 100 adet"). */}
                      <div className="text-xl font-bold tabular-nums">
                        {fmt(item.total)} {x.currency}
                      </div>
                      <div className="text-[10.5px] text-gri-500 tabular-nums">
                        {x.decimal(item.unit)} {x.currency} × {fmt(item.qty)} adet
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {/* Sefa-11 + 20 May test #3: Düzenle butonu — item
                          snapshot localStorage'a yazılıp konfigüratöre yönlendirir.
                          Konfigüratör mount'ta loadEditIntent ile state'i geri
                          yükler, "Sepete Ekle" eskiyi sil + yeniyi ekle (replace). */}
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        aria-label={`${item.title} düzenle`}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] text-pim-mercan hover:bg-pim-mercan/5 font-semibold transition-colors"
                      >
                        <Icon.Edit size={13} />
                        {x.editLink}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        aria-label={`${item.title} sepetten kaldır`}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] text-gri-500 hover:text-kirmizi hover:bg-kirmizi/5 font-semibold transition-colors"
                      >
                        <Icon.X size={13} />
                        {t.common.remove}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {/* Sefa-11: Alışverişe devam CTA — "← Etiket / ← Sticker" küçük
                belirsiz linkler yerine, etiketli grup buton */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[12.5px] text-gri-500">
                {x.continueShoppingLabel}
              </span>
              <Link
                href="/etiket"
                className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12.5px] font-semibold text-pim-mercan ring-1 ring-pim-mercan/30 hover:bg-pim-mercan-tint transition-colors"
              >
                <Icon.Roll size={13} /> {t.nav.etiket}
              </Link>
              <Link
                href="/sticker"
                className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12.5px] font-semibold text-pim-mercan ring-1 ring-pim-mercan/30 hover:bg-pim-mercan-tint transition-colors"
              >
                <Icon.Sticker size={13} /> {t.nav.sticker}
              </Link>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="lg:sticky lg:top-20">
            <Card padding="p-6">
              <h3 className="font-semibold text-lg mb-4">{t.cart.summary}</h3>
              <div className="space-y-2.5 text-[14px]">
                {/* Sefa-9: KDV kırılımı — birim fiyatlar zaten KDV dahil,
                    geri çıkarıyoruz. B2B muhasebe için kritik. */}
                <div className="flex justify-between">
                  <span className="text-gri-700">{x.subtotalNoVat}</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(subtotal / (1 + VAT_RATE))} {x.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">{x.vatLabel}</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(subtotal - subtotal / (1 + VAT_RATE))} {x.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">{t.cart.shipping}</span>
                  <span className="font-semibold tabular-nums">
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
                      <span>{fmt(subtotal)} ₺</span>
                      <span>{fmt(FREE_SHIPPING_THRESHOLD)} ₺</span>
                    </div>
                  </div>
                )}
                {/* Sefa-8: Kargo bedava — sadece kutlama değil, gerçek
                    rakamlar göster (X/Y ₺). */}
                {shipping === 0 && subtotal > 0 && (
                  <div
                    className="bg-yesil-soft text-yesil p-2.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5"
                    aria-label={`Kargo bedava: ${fmt(subtotal)} ₺, eşik ${fmt(FREE_SHIPPING_THRESHOLD)} ₺`}
                  >
                    <span aria-hidden="true">🎉</span>
                    {x.shippingFreeFull(fmt(subtotal), fmt(FREE_SHIPPING_THRESHOLD))}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="font-semibold">{t.cart.total}</span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt(total)}{" "}
                  <span className="text-base font-semibold text-gri-700">
                    {x.currency}
                  </span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right mt-1">
                {t.cart.vatIncluded}
              </div>

              {/* Sefa 18 May v68 Migration 053: min/max sipariş limit uyarıları */}
              {minOrderTotal > 0 && total < minOrderTotal && total > 0 && (
                <div className="mt-4 rounded-lg bg-sari-soft p-3 ring-1 ring-sari/30 text-[12.5px] text-sari-koyu">
                  <div className="font-semibold mb-1">
                    ⚠️ Minimum sipariş tutarı {fmt(minOrderTotal)} ₺
                  </div>
                  <p className="leading-relaxed">
                    Sepete <strong>{fmt(minOrderTotal - total)} ₺</strong> daha
                    eklemen gerekiyor. Adet yükselt veya yeni ürün ekle.
                  </p>
                </div>
              )}
              {maxOrderTotal > 0 && total > maxOrderTotal && (
                <div className="mt-4 rounded-lg bg-mavi-soft p-3 ring-1 ring-mavi/30 text-[12.5px] text-mavi-koyu">
                  <div className="font-semibold mb-1">
                    📞 Toplu sipariş — WhatsApp'a yönlendir
                  </div>
                  <p className="leading-relaxed mb-2">
                    Sepetin {fmt(maxOrderTotal)} ₺'yi aştı. Bu büyüklükteki
                    siparişler için <strong>özel teklif</strong> hazırlıyoruz —
                    daha iyi fiyat + kişisel destek.
                  </p>
                  <a
                    href="https://wa.me/905330000000?text=Toplu%20sipari%C5%9F%20i%C3%A7in%20bilgi%20almak%20istiyorum"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-mavi-koyu underline"
                  >
                    WhatsApp'tan ulaş →
                  </a>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                block
                href={
                  minOrderTotal > 0 && total < minOrderTotal
                    ? "#"
                    : "/odeme"
                }
                className={`mt-5 ${
                  minOrderTotal > 0 && total < minOrderTotal
                    ? "opacity-50 cursor-not-allowed pointer-events-none"
                    : ""
                }`}
              >
                {t.cart.proceedToCheckout} <Icon.ArrowR />
              </Button>

              {/* Sefa-7: Tahmini teslimat — ürün tipine göre. Sticker
                  3-5, etiket 5-7. Karışık sepette en uzun süreyi gösterir. */}
              <div className="mt-4 flex items-start gap-2 bg-gri-50 rounded-lg p-3">
                <Icon.Package size={18} className="text-pim-mercan shrink-0 mt-0.5" />
                <div className="text-[12px] leading-relaxed">
                  <div className="font-semibold text-lacivert">
                    {x.estDelivery}:{" "}
                    <span className="text-pim-mercan">
                      {cart.some((i) => i.product === "etiket")
                        ? x.deliveryDays.etiket
                        : x.deliveryDays.sticker}
                    </span>
                  </div>
                  <div className="text-gri-700 text-[11px] mt-0.5">
                    {x.deliveryNote}
                  </div>
                </div>
              </div>

              {/* Sefa-6 + 20 May test #7/#8: Trust rozetleri — ödeme
                  sayfasındaki yeşil rounded rozet + PayTR logo pattern'i.
                  "36 saat iade garantisi" linki kaldırıldı. */}
              <div className="mt-4 pt-3 border-t border-gri-200">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-yesil-soft text-yesil text-[12.5px] font-semibold">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    SSL
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-gri-100 ring-1 ring-gri-200"
                    aria-label="PayTR ile güvenli ödeme"
                    title="PayTR ile güvenli ödeme"
                  >
                    <span className="text-[11px] font-semibold text-gri-700 uppercase tracking-[0.04em]">
                      Ödeme altyapısı
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logos/paytr/paytr-color.svg"
                      alt="PayTR"
                      width="52"
                      height="14"
                      style={{ height: "14px", width: "auto" }}
                    />
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Sefa-12: Mobile sticky bottom bar — Toplam + Ödemeye geç.
          lg breakpoint üstünde gizli (sticky özet kart var). Aşağıdaki
          padding-bottom main'de pb-20 zaten var, bottom bar yer bırakır. */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gri-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
        role="region"
        aria-label="Mobil sepet özeti"
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] text-gri-500 uppercase tracking-wider">
              {x.mobileCheckoutTotal}
            </div>
            <div className="text-[18px] font-bold tabular-nums leading-tight">
              {fmt(total)} <span className="text-[13px] font-semibold text-gri-700">{x.currency}</span>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            href={
              minOrderTotal > 0 && total < minOrderTotal
                ? "#"
                : "/odeme"
            }
            className={
              minOrderTotal > 0 && total < minOrderTotal
                ? "opacity-50 pointer-events-none"
                : ""
            }
          >
            {t.cart.proceedToCheckout} <Icon.ArrowR />
          </Button>
        </div>
      </div>
    </main>
  );
}
