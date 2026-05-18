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
import { useSiteImage } from "@/lib/site-images-client";
import { useUser } from "@/lib/supabase/use-user";

// Sefa kararı 17 May v11: baselineStickerPrice/baselineEtiketPrice/
// formatUnitPriceLocale helper'ları + QuickReorderWidget + Product
// Cards section'ları kaldırıldı (anasayfa sadeleştirildi).
// ProductCard sub-component'i, RolloPreview/StickerPile mockup'ları da
// kullanılmıyor → silindi.

// Sefa 18 May v68: Anasayfa SSS özeti — /sss tam sayfayla uyumlu.
// "Acele baskı" sorusu kaldırıldı (Sefa: "acele baskı yapmıyoruz").
const FAQ_QUESTIONS_TR = [
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
    a: "Standart etiket siparişleri 10 iş günü, sticker siparişleri 5 iş günü içinde üretilmektedir (resmi tatiller hariç). Üretim tamamlandıktan sonra kargo süresi şehir bazında 1-3 iş günüdür. Tahmini teslim tarihi konfigüratör ve sepet ekranında otomatik olarak hesaplanıp gösterilir.",
  },
];

const FAQ_QUESTIONS_EN = [
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
    a: "Standard production lead times are 10 business days for labels and 5 business days for stickers (excluding public holidays). Shipping adds 1-3 business days depending on the city. Estimated delivery date is calculated and displayed automatically at checkout.",
  },
];

export default function HomePage() {
  const { t, locale } = useT();
  const { user } = useUser();
  // Admin panelinden yüklenen görsel slot'u (varsa Pim fallback'i ezer)
  // Product Cards kaldırıldığı için home_etiket_card / home_sticker_card
  // artık kullanılmıyor (slot'lar admin'de hâlâ durur, ileride kullanılırsa).
  const homeHero = useSiteImage("home_hero");

  // PILLARS array kaldırıldı (Sefa kararı 17 May v10) — section silindi

  const STEPS = [
    { n: "01", t: t.home.step1, d: t.home.step1Desc },
    { n: "02", t: t.home.step2, d: t.home.step2Desc },
    { n: "03", t: t.home.step3, d: t.home.step3Desc },
    { n: "04", t: t.home.step4, d: t.home.step4Desc },
  ];

  const FAQS = locale === "en" ? FAQ_QUESTIONS_EN : FAQ_QUESTIONS_TR;
  return (
    <main className="animate-fade-up">
      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden pt-10 md:pt-16 pb-12 md:pb-20">
        {/* Hero bg — krem-soft soft gradient. Görselin (bal kavanozu)
            açık bej arka planı sayfayla kaynaşıyor (Sefa 17 May v14). */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(1100px 560px at 75% 38%, var(--color-krem-soft) 0%, var(--color-krem-soft) 25%, transparent 70%)",
          }}
        />
        {/* Uçuşan etiketler kaldırıldı (Sefa kararı 12 May) */}
        <div className="relative mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-14 items-center">
          {/* LEFT — copy */}
          <div>
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
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" size="lg" href="/etiket">
                <Icon.Roll size={18} /> {t.home.ctaEtiket}
              </Button>
              <Button variant="secondary" size="lg" href="/sticker">
                <Icon.Sticker size={18} /> {t.home.ctaSticker}
              </Button>
            </div>
            {/* Sefa kuralı (16 May denetim #23): Oturum açıkken
                "Hesap aç" mikrokopisi gizli — kullanıcı zaten girmiş. */}
            {!user && (
              <div className="mt-3 flex items-center gap-1.5 text-[13px] text-gri-700">
                <Icon.User size={13} className="text-gri-500" />
                <span>
                  {locale === "en" ? "For your first order" : "İlk siparişin için"}
                </span>
                <Link
                  href="/auth?mode=signup"
                  className="text-pim-mercan font-semibold underline underline-offset-2 decoration-1 hover:decoration-2"
                >
                  {locale === "en"
                    ? "create a free account"
                    : "ücretsiz hesap aç"}
                </Link>
                <span className="text-gri-500">
                  — {locale === "en" ? "30 seconds" : "30 saniye"}
                </span>
              </div>
            )}
            {/* Sefa kararı 17 May v10: 3 pill chip kaldırıldı
                (Düşük adetten esnek / AI dosya kontrolü / Türkiye geneli teslimat).
                3 PILLAR card ile aynı mesaj duplicate ediyordu → ikisi de
                kaldırıldı, hero açıklamasında zaten geçiyor. */}
          </div>

          {/* RIGHT — Hero görsel (Sefa 17 May v14)
              · 5:4 yatay, daha yumuşak edge
              · Halo + mask krem rengiyle uyumlu (görselin arka plan bej
                tonu sayfanın krem-soft arka planıyla doğal kaynaşır)
              · Drop shadow krem-koyu tonunda warm gölge */}
          <div className="relative flex justify-center items-center min-h-[360px] md:min-h-[460px]">
            {/* Soft krem halo — görselin arka plan bej tonuyla aynı palette */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 95% 75% at center, var(--color-krem-soft) 0%, var(--color-krem-soft) 35%, transparent 80%)",
              }}
            />

            {/* Görsel — geniş yumuşak mask + warm drop shadow.
                Sefa 17 May v33: next/image ile otomatik WebP/AVIF + responsive
                sizes + priority (LCP image). Local fallback için Image, DB
                URL'i için <img> (Supabase Storage remote pattern config
                yapılana kadar). */}
            <div className="relative z-10 w-full max-w-[640px] aspect-[5/4]">
              {homeHero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={homeHero.publicUrl}
                  alt={
                    homeHero.altText ??
                    "Pim Etiket — bal kavanozu, rulo etiket ve sticker örnekleri"
                  }
                  className="w-full h-full object-cover drop-shadow-[0_25px_45px_rgba(180,140,90,0.18)]"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse 95% 85% at center, black 40%, transparent 95%)",
                    maskImage:
                      "radial-gradient(ellipse 95% 85% at center, black 40%, transparent 95%)",
                  }}
                />
              ) : (
                <Image
                  src="/hero/home-hero.png"
                  alt="Pim Etiket — bal kavanozu, rulo etiket ve sticker örnekleri"
                  width={1200}
                  height={960}
                  priority
                  sizes="(max-width: 768px) 100vw, 640px"
                  className="w-full h-full object-cover drop-shadow-[0_25px_45px_rgba(180,140,90,0.18)]"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse 95% 85% at center, black 40%, transparent 95%)",
                    maskImage:
                      "radial-gradient(ellipse 95% 85% at center, black 40%, transparent 95%)",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sefa kararı 17 May v11: QuickReorderWidget + Product Cards
          section'ları kaldırıldı.
          - "YENİDEN BASTIR" card (sticker · kare · 50×50mm · 1.520 TL) →
            kullanıcı zaten /panelim'de geçmiş siparişlerini görüyor
          - Etiket / Sticker product cards (2,05 TL/adet · 30,55 TL/adet) →
            hero'da iki büyük CTA buton ("Etiket bastır" + "Sticker bastır")
            zaten aynı yere yönlendiriyor; duplicate.
          Yeni akış: Hero → How it works → Reviews → FAQ */}

      {/* ============================== HOW IT WORKS ============================== */}
      <section className="py-20 bg-gri-50">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="text-center mb-12">
            <Eyebrow>{t.home.howItWorksEyebrow}</Eyebrow>
            <h2 className="mt-4 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight max-w-[640px] mx-auto">
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
                  <div className="step-circle-anim grid place-items-center w-[72px] h-[72px] rounded-full bg-white ring-2 ring-gri-200 mx-auto mb-5 font-bold text-[22px] text-pim-mercan shadow-1">
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

      {/* ============================== REVIEWS ============================== */}
      <HomeReviews limit={9} />

      {/* ============================== FAQ ============================== */}
      <section className="py-12">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-16 items-start">
          <div>
            <Eyebrow>{t.home.faqEyebrow}</Eyebrow>
            <h2 className="mt-4 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
              {t.home.faqTitle}
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

      {/* Sefa kararı 17 May v13: Trust strip + Bottom CTA section'ları kaldırıldı.
          - Trust strip (3D Secure / Hızlı kargo / AI dosya / KVKK) → footer'da
            zaten 4 güven rozeti var, ayrıca FAQ bölümünde mesaj veriliyor.
          - Bottom CTA "Hadi başlayalım" (Pim karga + Etiket bastır/Sticker'a
            göz at butonları) → hero'da aynı CTA var, duplicate.
          Anasayfa şimdi: Hero → How it works → Reviews → FAQ → Footer. */}
    </main>
  );
}

