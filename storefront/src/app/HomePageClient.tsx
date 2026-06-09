/**
 * Pim Etiket — Anasayfa (E.1.1)
 *
 * Client component — i18n hook için. Metadata layout.tsx'te (root).
 * Pricing engine fonksiyonları saf TS — client-side'da da çalışır.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { HomeReviews } from "@/components/reviews/HomeReviews";
import { HomeGallery } from "@/components/home/HomeGallery";
import { HomeInstagram } from "@/components/home/HomeInstagram";
import { HomeBlogSection } from "@/components/blog/BlogPreview";
import { Pim } from "@/components/Pim";
import { useSiteImage } from "@/lib/site-images-client";
import { useUser } from "@/lib/supabase/use-user";
import { ETIKET_ENABLED } from "@/lib/etiket-feature-flags";
import { useMemo } from "react";
import { formatDeliveryDaysLabel } from "@/lib/site-settings-shared";
import { useDeliveryDays } from "@/hooks/useDeliveryDays";

// Sefa kararı 17 May v11: baselineStickerPrice/baselineEtiketPrice/
// formatUnitPriceLocale helper'ları + QuickReorderWidget + Product
// Cards section'ları kaldırıldı (anasayfa sadeleştirildi).
// ProductCard sub-component'i, RolloPreview/StickerPile mockup'ları da
// kullanılmıyor → silindi.

// Sefa 18 May v68: Anasayfa SSS özeti — /sss tam sayfayla uyumlu.
// Teslim günleri site_settings'ten (useDeliveryDays).
function buildHomeFaqs(
  locale: "tr" | "en",
  deliveryDays: { sticker: number; etiket: number }
) {
  const etiketLabel = formatDeliveryDaysLabel(deliveryDays.etiket, locale);
  const stickerLabel = formatDeliveryDaysLabel(deliveryDays.sticker, locale);

  if (locale === "en") {
    return [
      {
        q: "What is the minimum order quantity at Pim Etiket?",
        a: "Roll labels start at 1,000 units, sheet labels at 250, and stickers at 25. The live preview in the configurator shows how many items fit per sheet, helping you plan your order size.",
      },
      {
        q: "I don't have a design file — what should I do?",
        a: "Free online design tools such as Canva, Adobe Express, and Figma make it easy to prepare your artwork. Export your design as PDF or PNG and upload it to our system. For industry-specific color palette or typography suggestions, ask the Pim Etiket chat assistant.",
      },
      {
        q: "How long does production and delivery take?",
        a: `Standard production lead times are ${etiketLabel} for labels and ${stickerLabel} for stickers (excluding public holidays). Shipping adds 1-3 business days depending on the city. Estimated delivery date is calculated and displayed automatically at checkout.`,
      },
    ];
  }

  return [
    {
      q: "Pim Etiket'te minimum kaç adet sipariş verilebilir?",
      a: "Rulo etiket siparişleri 1.000 adetten, tabaka etiket siparişleri 250 adetten, sticker siparişleri ise 25 adetten başlamaktadır. Tabaka başına kaç ürün sığacağını konfigüratör ekranındaki canlı önizleme bölümünden görüntüleyebilirsiniz.",
    },
    {
      q: "Tasarım dosyam yok, nasıl bir yol izlemeliyim?",
      a: "Canva, Adobe Express ve Figma gibi ücretsiz online tasarım araçlarıyla tasarımınızı hazırlayıp PDF veya PNG formatında indirebilir, ardından sistemimize yükleyebilirsiniz. Sektörünüze uygun renk paleti ve font kombinasyonu önerileri için Pim Etiket sohbet asistanına sorularınızı yöneltebilirsiniz.",
    },
    {
      q: "Üretim ve teslimat süresi ne kadardır?",
      a: `Standart etiket siparişleri ${etiketLabel}, sticker siparişleri ${stickerLabel} içinde üretilmektedir (resmi tatiller hariç). Üretim tamamlandıktan sonra kargo süresi şehir bazında 1-3 iş günüdür. Tahmini teslim tarihi konfigüratör ve sepet ekranında otomatik olarak hesaplanıp gösterilir.`,
    },
  ];
}

export default function HomePage() {
  const { t, locale } = useT();
  const { user } = useUser();
  const deliveryDays = useDeliveryDays();
  const homeLocale = locale === "en" ? "en" : "tr";
  // Admin panelinden yüklenen görsel slot'u (varsa Pim fallback'i ezer)
  // Product Cards kaldırıldığı için home_etiket_card / home_sticker_card
  // artık kullanılmıyor (slot'lar admin'de hâlâ durur, ileride kullanılırsa).
  const homeHero = useSiteImage("home_hero");

  // PILLARS array kaldırıldı (Sefa kararı 17 May v10) — section silindi

  const STEPS = useMemo(
    () => [
      { n: "01", t: t.home.step1, d: t.home.step1Desc },
      { n: "02", t: t.home.step2, d: t.home.step2Desc },
      { n: "03", t: t.home.step3, d: t.home.step3Desc },
      {
        n: "04",
        t: t.home.step4,
        d:
          homeLocale === "en"
            ? `Labels ${formatDeliveryDaysLabel(deliveryDays.etiket, "en")} to ship, stickers ${formatDeliveryDaysLabel(deliveryDays.sticker, "en")}.`
            : `Etiket ${formatDeliveryDaysLabel(deliveryDays.etiket, "tr")}, sticker ${formatDeliveryDaysLabel(deliveryDays.sticker, "tr")} içinde kargoda.`,
      },
    ],
    [t.home, deliveryDays, homeLocale]
  );

  const FAQS = useMemo(
    () => buildHomeFaqs(homeLocale, deliveryDays),
    [homeLocale, deliveryDays]
  );
  return (
    <main className="animate-fade-up">
      {/* ============================== SECTION ORDER ==============================
        GERİ ALMA: Bu yorumdaki sıra orijinaldir. Sefa beğenmezse
        section'ları bu sıraya geri getir:

        ORIGINAL ORDER (25 May 2026 öncesi):
          1. Hero
          2. How it works (py-20 bg-gri-50)
          3. HomeReviews
          4. FAQ (py-12)

        YENİ ORDER:
          1. Hero (+ CTA mikrokopi)
          2. How it works
          3. Galeri (baskı örnekleri)
          4. HomeReviews
          5. FAQ + Pim
          6. Blog
          7. Instagram
          8. Mobile sticky CTA
      ============================== */}

      {/* ============================== HERO ============================== */}
      {/* Sefa 23 May v68 (overlay refactor):
          Önceki: banner üstte, metin altta. Yeni: metin banner'ın
          ÜZERINDE (sol tarafta vertical center). Banner full-bleed +
          beyaz gradient sol overlay metin okunabilirliği için. */}
      <section className="relative w-full min-h-[480px] md:min-h-[600px] overflow-hidden">
        {/* Full-bleed banner görsel — section'un arka planı */}
        {homeHero ? (
          <Image
            src={homeHero.publicUrl}
            alt={
              homeHero.altText ??
              "Pim Etiket — sticker, etiket ve uygulama örnekleri"
            }
            fill
            priority
            sizes="100vw"
            className="object-cover -z-10"
          />
        ) : (
          <Image
            src="/hero/home-hero.jpg"
            alt="Pim Etiket — sticker, etiket, kavanoz, laptop ve mug uygulama örnekleri"
            fill
            priority
            sizes="100vw"
            className="object-cover -z-10"
          />
        )}

        {/* Sefa 23 May v68 (revize): "yazilarin altinda serit gibi" —
            tum sol yari overlay degil, sadece metni saran beyaz card/serit.
            Overlay div kaldirildi, text wrapper'a bg-white + padding +
            rounded + soft shadow eklendi. */}

        {/* Metin overlay — sol-vertical center, container içinde */}
        <div className="relative mx-auto max-w-[1280px] min-h-[480px] md:min-h-[600px] px-4 md:px-8 flex items-center">
          <div className="max-w-[560px] bg-white/95 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-[0_20px_50px_-15px_rgba(60,40,20,0.18)]">
            <Eyebrow>{t.home.eyebrow}</Eyebrow>
            <h1 className="mt-5 text-[34px] md:text-[56px] leading-[1.04] font-semibold tracking-[-0.02em]">
              {t.home.h1Brand}
              <br />
              <span className="relative text-pim-mercan">
                {t.home.h1Idea}
                <svg
                  width="240"
                  height="14"
                  viewBox="0 0 240 14"
                  className="absolute left-0 -bottom-1.5 w-full"
                  aria-hidden
                >
                  {/* Sefa 17 May v28: çizgi minimal "self-draw" animasyonu
                      (6s döngü, gözü yormayan yavaş hareket) */}
                  <path
                    d="M2 8 Q60 2 120 8 T238 6"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    className="h1-underline-anim"
                  />
                </svg>
              </span>
            </h1>
            <p className="mt-6 text-lg text-gri-700 max-w-[480px] leading-relaxed">
              {t.home.heroDescription}
            </p>
            {/* Sefa 22 May v68: Sticker önde + primary (Sefa kararı —
                sticker satışı önceliği). Etiket secondary olarak ikinci. */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" size="lg" href="/sticker">
                <Icon.Sticker size={18} /> {t.home.ctaSticker}
              </Button>
              {ETIKET_ENABLED && (
                <Button variant="secondary" size="lg" href="/etiket">
                  <Icon.Roll size={18} /> {t.home.ctaEtiket}
                </Button>
              )}
            </div>
            {/* Sefa kuralı (16 May denetim #23): Oturum açıkken
                "Hesap aç" mikrokopisi gizli — kullanıcı zaten girmiş. */}
            {!user && (
              <div className="mt-3 flex items-center gap-1.5 text-[13px] text-gri-700">
                <Icon.User size={13} className="text-gri-600" />
                <span>
                  {locale === "en" ? "For your first order" : "İlk siparişin için"}
                </span>
                <Link
                  href="/auth?mode=signup"
                  className="text-pim-mercan-koyu font-semibold underline underline-offset-2 decoration-1 hover:decoration-2"
                >
                  {locale === "en"
                    ? "create a free account"
                    : "ücretsiz hesap aç"}
                </Link>
                <span className="text-gri-600">
                  — {locale === "en" ? "30 seconds" : "30 saniye"}
                </span>
              </div>
            )}
            {/* Sefa kararı 17 May v10: 3 pill chip kaldırıldı
                (Düşük adetten esnek / AI dosya kontrolü / Türkiye geneli teslimat).
                3 PILLAR card ile aynı mesaj duplicate ediyordu → ikisi de
                kaldırıldı, hero açıklamasında zaten geçiyor. */}
          </div>
        </div>
      </section>

      {/* Sefa kararı 17 May v11: QuickReorderWidget + Product Cards
          section'ları kaldırıldı.
          - "YENİDEN BASTIR" card (sticker · kare · 50×50mm · 1.520 ₺) →
            kullanıcı zaten /panelim'de geçmiş siparişlerini görüyor
          - Etiket / Sticker product cards (2,05 ₺/adet · 30,55 ₺/adet) →
            hero'da iki büyük CTA buton ("Etiket bastır" + "Sticker bastır")
            zaten aynı yere yönlendiriyor; duplicate.
          Yeni akış: Hero → How it works → Reviews → FAQ */}

      {/* ============================== HOW IT WORKS ============================== */}
      <section className="py-20 bg-gri-50">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight max-w-[640px] mx-auto">
              {t.home.howItWorksTitle}
            </h2>
          </div>
          <div className="relative">
            {/* Akış animasyonu (Sefa 17 May v22):
                · Alt çizgi: bg-gri-200 statik gri zemin
                · Üst çizgi: .flow-line — sağa kayan mercan parıltı (3.5s döngü) */}
            <div
              aria-hidden
              className="hidden md:block absolute left-[12.5%] right-[12.5%] top-9 h-0.5 bg-gri-200 z-0"
            />
            <div
              aria-hidden
              className="hidden md:block absolute left-[12.5%] right-[12.5%] top-9 h-0.5 flow-line z-0"
            />
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 z-10">
              {STEPS.map((s, i) => (
                <div key={i} className="text-center">
                  {/* step-circle-anim → sırayla pulse (0s, 0.85s, 1.7s, 2.55s) */}
                  <div className="step-circle-anim grid place-items-center w-[72px] h-[72px] rounded-full bg-white ring-2 ring-gri-200 mx-auto mb-5 font-bold text-[22px] text-pim-mercan-koyu shadow-1">
                    {s.n}
                  </div>
                  <h3 className="text-xl font-semibold mb-1.5">{s.t}</h3>
                  <p className="text-base text-gri-700 max-w-[220px] mx-auto leading-relaxed">
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== PRODUCTION QUALITY ============================== */}
      <section className="py-16 md:py-20 bg-white">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <h2 className="text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight text-lacivert mb-10 md:mb-12 max-w-[560px]">
            {t.home.productionQualityTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {[
              {
                icon: <Icon.Package size={22} />,
                title: t.home.productionQuality1Title,
                desc: t.home.productionQuality1Desc,
              },
              {
                icon: <Icon.Sparkle size={22} />,
                title: t.home.productionQuality2Title,
                desc: t.home.productionQuality2Desc,
              },
              {
                icon: <Icon.Shield size={22} />,
                title: t.home.productionQuality3Title,
                desc: t.home.productionQuality3Desc,
              },
              {
                icon: <Icon.Check size={22} />,
                title: t.home.productionQuality4Title,
                desc: t.home.productionQuality4Desc,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-2xl bg-pim-mercan-tint/60 ring-1 ring-pim-mercan/10 p-6 md:p-7"
              >
                <span className="grid shrink-0 place-items-center w-14 h-14 rounded-full bg-white text-pim-mercan-koyu shadow-1 ring-1 ring-pim-mercan/15">
                  {item.icon}
                </span>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-lg font-semibold text-lacivert mb-1">
                    {item.title}
                  </h3>
                  <p className="text-base text-gri-700 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Button variant="secondary" href="/nasil-uretiyoruz">
              {t.home.productionQualityCta} <Icon.ChevR size={14} />
            </Button>
          </div>
        </div>
      </section>

      <HomeGallery locale={locale} />

      {/* ============================== REVIEWS ============================== */}
      <HomeReviews limit={9} />

      {/* ============================== FAQ ============================== */}
      <section className="py-12">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-16 items-start">
          <div>
            <h2 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
              {homeLocale === "en" ? (
                <>
                  Answer is usually &ldquo;
                  <span className="inline-flex items-center gap-1.5 align-middle mx-0.5">
                    <Pim pose="wave" size={48} bob={false} className="shrink-0" />
                    yes
                  </span>
                  , we got you&rdquo;.
                </>
              ) : (
                <>
                  Cevap genelde &ldquo;
                  <span className="inline-flex items-center gap-1.5 align-middle mx-0.5">
                    <Pim pose="wave" size={48} bob={false} className="shrink-0" />
                    evet
                  </span>
                  , hallederiz&rdquo;.
                </>
              )}
            </h2>
            <p className="mt-6 text-base text-gri-700 mb-6 leading-relaxed">
              {t.home.faqHelp}
            </p>
            <Button variant="secondary" href="/sss">
              {t.home.faqAll} <Icon.ChevR size={14} />
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {FAQS.map((f, i) => (
              <details
                key={i}
                className="bg-white rounded-lg shadow-1 ring-1 ring-black/[0.04] px-6 py-4 cursor-pointer group"
              >
                <summary className="flex justify-between items-center list-none font-semibold text-base">
                  {f.q}
                  <span className="text-pim-mercan text-xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-base text-gri-700 leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <HomeBlogSection locale={locale} limit={3} />

      <HomeInstagram locale={locale} />

      {/* ============================== MOBILE STICKY CTA ============================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-sm border-t border-gri-200 shadow-lg px-4 py-3 safe-area-bottom">
        <div className="flex gap-2.5">
          <Button variant="primary" size="sm" href="/sticker" className="flex-1">
            <Icon.Sticker size={14} /> {t.home.ctaSticker}
          </Button>
          {ETIKET_ENABLED && (
            <Button variant="secondary" size="sm" href="/etiket" className="flex-1">
              <Icon.Roll size={14} /> {t.home.ctaEtiket}
            </Button>
          )}
        </div>
      </div>
      <div className="h-16 md:hidden" aria-hidden />

      {/* Sefa kararı 17 May v13: Trust strip + Bottom CTA section'ları kaldırıldı.
          - Trust strip (3D Secure / Hızlı kargo / AI dosya / KVKK) → footer'da
            zaten 4 güven rozeti var, ayrıca FAQ bölümünde mesaj veriliyor.
          - Bottom CTA "Hadi başlayalım" (Pim karga + Etiket bastır/Sticker'a
            göz at butonları) → hero'da aynı CTA var, duplicate.
          Anasayfa şimdi: Hero → How it works → Reviews → FAQ → Footer. */}
    </main>
  );
}

