/**
 * Pim Etiket — Anasayfa (E.1.1)
 *
 * Client component — i18n hook için. Metadata layout.tsx'te (root).
 * Pricing engine fonksiyonları saf TS — client-side'da da çalışır.
 */

"use client";

import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Pill, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { quoteCustomerSticker } from "@/lib/sticker-customer-pricing";
import { quoteCustomerEtiket } from "@/lib/etiket-customer-pricing";
import { HomeReviews } from "@/components/reviews/HomeReviews";
import { QuickReorderWidget } from "@/components/home/QuickReorderWidget";
import { useSiteImage } from "@/lib/site-images-client";
import { useUser } from "@/lib/supabase/use-user";

// Anasayfa baseline fiyatları — engine'den hesaplanır (server-side, build time).
// "Popüler tier × tipik boyut × sade konfigürasyon" ile gösterilir.
// Sticker 250 (popüler), etiket 2000 (popüler) — fixed cost yayıldığında
// daha makul birim fiyat görünür ("ucuz baskı" mesajıyla uyumlu).
function baselineStickerPrice(): number | "—" {
  // 250 adet (popüler tier) baseline — fixed cost yayılınca makul birim
  const r = quoteCustomerSticker({
    width: 75,
    height: 75,
    material: "vinil",
    finish: "parlak",
    qty: 250,
  });
  if (!r.ok) return "—";
  return r.unitPrice;
}

function baselineEtiketPrice(): number | "—" {
  const r = quoteCustomerEtiket({
    width: 60,
    height: 80,
    qty: 2000,
    material: "kraft",
    coating: "yok",
    customization: "yok",
  });
  if (!r.ok) return "—";
  return r.unitPrice;
}

/** Locale-aware unit price format — TR "2,05 TL/adet", EN "2.05 TRY/pc" */
function formatUnitPriceLocale(
  value: number | "—" | string,
  locale: "tr" | "en"
): string {
  if (value === "—" || typeof value !== "number") return "—";
  if (locale === "en") {
    return `${value.toFixed(2)} TRY/pc`;
  }
  return `${value.toFixed(2).replace(".", ",")} TL/adet`;
}

const FAQ_QUESTIONS_TR = [
  {
    q: "Minimum kaç adet basabiliyorum?",
    a: "Etiket için 1000, sticker için 25 adetten başlıyoruz.",
  },
  {
    q: "Tasarım dosyam yok, ne yapacağım?",
    a: "Pim'e söyle, basit bir tasarım için kütüphanemizdeki şablonlardan birini özelleştirebilirsin; daha karmaşık iş için partner stüdyolarımızla bağlarız.",
  },
  {
    q: "10 günden hızlı teslim mümkün mü?",
    a: "Evet, 'hızlı şerit' opsiyonu ile 5 güne kadar düşürebiliyoruz; ek ücreti konfigürasyon sayfasında görürsün.",
  },
];

const FAQ_QUESTIONS_EN = [
  {
    q: "What's the minimum order quantity?",
    a: "1000 for labels, 25 for stickers — that's where we start.",
  },
  {
    q: "I don't have a design file, what now?",
    a: "Tell Pim — for simple designs you can customize one of our templates; for more complex work we connect you with partner studios.",
  },
  {
    q: "Can I get faster than 10-day delivery?",
    a: "Yes — the 'fast track' option brings it down to 5 days; the surcharge appears on the configurator.",
  },
];

export default function HomePage() {
  const { t, locale } = useT();
  const { user } = useUser();
  // Admin panelinden yüklenen görsel slot'lar (varsa fallback'leri ezer)
  const homeHero = useSiteImage("home_hero");
  const etiketCardImage = useSiteImage("home_etiket_card");
  const stickerCardImage = useSiteImage("home_sticker_card");

  const PILLARS = [
    { icon: <Icon.Bolt size={22} />, t: t.home.pillar1Title, d: t.home.pillar1Desc },
    { icon: <Icon.Sparkle size={22} />, t: t.home.pillar2Title, d: t.home.pillar2Desc },
    { icon: <Icon.Truck size={22} />, t: t.home.pillar3Title, d: t.home.pillar3Desc },
  ];

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
        <div
          aria-hidden
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 480px at 78% 28%, var(--color-krem) 0%, transparent 60%)",
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
                  <path
                    d="M2 8 Q60 2 120 8 T238 6"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.5"
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
            {/* Sefa 17 May P1-7: hero chip'ler locale-aware (eski hardcoded TR) */}
            <div className="mt-10 flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-yesil-soft text-yesil text-[14px] font-semibold">
                <Icon.Check size={15} />{" "}
                {locale === "en"
                  ? "Flexible low quantities"
                  : "Düşük adetten esnek"}
              </span>
              <span className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-pim-mercan-tint text-pim-mercan text-[14px] font-semibold">
                <Icon.Sparkle size={15} />{" "}
                {locale === "en" ? "AI file check" : "AI dosya kontrolü"}
              </span>
              <span className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-krem text-lacivert text-[14px] font-semibold">
                <Icon.Truck size={15} />{" "}
                {locale === "en"
                  ? "Nationwide delivery"
                  : "Türkiye geneli teslimat"}
              </span>
            </div>
          </div>

          {/* RIGHT — Hero görsel (sadeleştirilmiş, Sefa 17 May v9)
              Önceki versiyonda 6 floating card (Olea/SHIP PIM/Rulo/AI/Truck/Decor)
              vardı — fazla görsel gürültü → kaldırıldı.
              Yerine: tek görsel + soft radial halo + edge mask fade. */}
          <div className="relative flex justify-center items-center min-h-[420px] md:min-h-[480px]">
            {/* Soft mercan halo — arkada radial gradient yumuşatma */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at center, rgba(255,107,91,0.10) 0%, rgba(255,107,91,0.04) 40%, transparent 70%)",
              }}
            />

            {/* Görsel — soft mask + drop shadow */}
            <div className="relative z-10 w-full max-w-[480px] aspect-square">
              {homeHero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={homeHero.publicUrl}
                  alt={homeHero.altText ?? "Pim Etiket"}
                  className="w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(255,107,91,0.18)]"
                  style={{
                    // Görselin kenarlarını yumuşat — radial mask
                    WebkitMaskImage:
                      "radial-gradient(ellipse 85% 85% at center, black 60%, transparent 100%)",
                    maskImage:
                      "radial-gradient(ellipse 85% 85% at center, black 60%, transparent 100%)",
                  }}
                />
              ) : (
                <div className="w-full h-full grid place-items-center">
                  <Pim
                    pose="wave"
                    size={340}
                    className="drop-shadow-[0_20px_40px_rgba(255,107,91,0.15)]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick reorder — sadece login + sipariş geçmişi varsa görünür */}
      <QuickReorderWidget />

      {/* ============================== 3 PILLAR ============================== */}
      <section className="pt-8 pb-16">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <Card key={i} padding="p-7">
              <div className="grid place-items-center w-11 h-11 rounded-xl bg-pim-mercan-tint text-pim-mercan mb-4">
                {p.icon}
              </div>
              <h3 className="text-xl font-semibold leading-snug mb-1.5">
                {p.t}
              </h3>
              <p className="text-base text-gri-700 leading-relaxed">{p.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ============================== PRODUCT CARDS ============================== */}
      <section className="py-12">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sefa 17 May P1-7: "1000 from" → "From 1,000" (EN sözdizimi)
              + unit price locale-aware */}
          <ProductCard
            kind="etiket"
            title={t.nav.etiket}
            sub={t.home.productEtiketSub}
            from={
              locale === "en" ? "From 1,000" : `${t.home.productFrom} 1000`
            }
            price={formatUnitPriceLocale(baselineEtiketPrice(), locale)}
            href="/etiket"
            priceLabel={t.home.productPriceLabel}
            ctaLabel={t.home.productConfigure}
            customImage={
              etiketCardImage
                ? {
                    url: etiketCardImage.publicUrl,
                    alt: etiketCardImage.altText ?? t.nav.etiket,
                  }
                : null
            }
          />
          <ProductCard
            kind="sticker"
            title={t.nav.sticker}
            sub={t.home.productStickerSub}
            from={locale === "en" ? "From 25" : `${t.home.productFrom} 25`}
            price={formatUnitPriceLocale(baselineStickerPrice(), locale)}
            href="/sticker"
            priceLabel={t.home.productPriceLabel}
            ctaLabel={t.home.productConfigure}
            customImage={
              stickerCardImage
                ? {
                    url: stickerCardImage.publicUrl,
                    alt: stickerCardImage.altText ?? t.nav.sticker,
                  }
                : null
            }
          />
        </div>
      </section>

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
            <div
              aria-hidden
              className="hidden md:block absolute left-[12.5%] right-[12.5%] top-9 h-0.5 bg-gri-200 z-0"
            />
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 z-10">
              {STEPS.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="grid place-items-center w-[72px] h-[72px] rounded-full bg-white ring-2 ring-gri-200 mx-auto mb-5 font-bold text-[22px] text-pim-mercan shadow-1">
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

      {/* ============================== TRUST STRIP ============================== */}
      <section className="py-10 bg-white border-y border-gri-100">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan">
                <Icon.Check size={18} />
              </div>
              <div className="text-[13px] font-semibold text-lacivert">
                3D Secure ödeme
              </div>
              <div className="text-[11.5px] text-gri-500">
                BDDK lisanslı altyapı
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-yesil-soft text-yesil">
                <Icon.Truck size={18} />
              </div>
              <div className="text-[13px] font-semibold text-lacivert">
                Hızlı kargo
              </div>
              <div className="text-[11.5px] text-gri-500">
                1.500 TL üzeri ücretsiz
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-krem text-lacivert">
                <Icon.Sparkle size={18} />
              </div>
              <div className="text-[13px] font-semibold text-lacivert">
                AI dosya kontrolü
              </div>
              <div className="text-[11.5px] text-gri-500">
                Üretime gitmeden uyarı
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan">
                <Icon.Star size={18} />
              </div>
              <div className="text-[13px] font-semibold text-lacivert">
                KVKK uyumlu
              </div>
              <div className="text-[11.5px] text-gri-500">
                Verilerin güvende
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== BOTTOM CTA ============================== */}
      <section className="py-20">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="relative overflow-hidden bg-lacivert text-white rounded-[32px] px-8 md:px-14 py-16">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="relative grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
                  {t.home.bottomCtaTitle}
                </h2>
                <p className="mt-4 text-lg text-white/75 max-w-[520px] leading-relaxed">
                  {t.home.bottomCtaDesc}
                </p>
                <div className="mt-7 flex gap-3 flex-wrap">
                  <Button variant="primary" size="lg" href="/etiket">
                    {t.home.bottomCtaPrimary} <Icon.ArrowR />
                  </Button>
                  <Link
                    href="/sticker"
                    className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full text-white font-semibold text-base ring-1 ring-white/30 hover:bg-white/10 hover:ring-white/60 transition-all"
                  >
                    {t.home.bottomCtaSecondary} <Icon.ArrowR size={16} />
                  </Link>
                </div>
                {/* CTA alt mikrocopy — friction azaltır */}
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-white/60">
                  <span className="flex items-center gap-1.5">
                    <Icon.Check size={12} className="text-yesil" /> Konfigüre
                    et, anlık fiyat çıkar
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon.Check size={12} className="text-yesil" /> Ödemeden
                    önce dosya kontrol
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon.Check size={12} className="text-yesil" /> Onaylamadan
                    üretime başlamayız
                  </span>
                </div>
              </div>
              <div className="flex justify-center">
                <Pim pose="excited" size={240} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ProductCard({
  kind,
  title,
  sub,
  from,
  price,
  href,
  priceLabel,
  ctaLabel,
  customImage,
}: {
  kind: "etiket" | "sticker";
  title: string;
  sub: string;
  from: string;
  price: string;
  href: string;
  priceLabel: string;
  ctaLabel: string;
  customImage?: { url: string; alt: string } | null;
}) {
  const isEtiket = kind === "etiket";
  return (
    <Link
      href={href}
      className="text-left bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] overflow-hidden flex flex-col sm:flex-row hover:-translate-y-0.5 transition-transform"
    >
      <div
        className={`flex-shrink-0 w-full sm:w-60 grid place-items-center min-h-[180px] sm:min-h-[220px] overflow-hidden ${
          isEtiket ? "bg-krem" : ""
        }`}
        style={
          !isEtiket && !customImage
            ? {
                background: "linear-gradient(135deg, #FFE7D6 0%, #FFA89E 100%)",
              }
            : undefined
        }
      >
        {customImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customImage.url}
            alt={customImage.alt}
            className="w-full h-full object-cover"
          />
        ) : isEtiket ? (
          <RolloPreview />
        ) : (
          <StickerPile />
        )}
      </div>
      <div className="p-7 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-2xl font-semibold m-0">{title}</h3>
          <Pill variant="krem">{from}</Pill>
        </div>
        <p className="text-base text-gri-700 mb-4 mt-1 leading-relaxed">
          {sub}
        </p>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700">
              {title} {priceLabel}
            </div>
            <div className="font-bold text-[22px]">{price}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-pim-mercan font-semibold">
            {ctaLabel} <Icon.ArrowR size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function RolloPreview() {
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden>
      <defs>
        <linearGradient id="rollo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E8DCC4" />
          <stop offset="50%" stopColor="white" />
          <stop offset="100%" stopColor="#E8DCC4" />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="40" rx="62" ry="14" fill="#1F2937" opacity="0.08" />
      <rect x="28" y="40" width="124" height="100" fill="url(#rollo)" />
      <ellipse cx="90" cy="40" rx="62" ry="14" fill="white" />
      <ellipse
        cx="90"
        cy="40"
        rx="62"
        ry="14"
        fill="none"
        stroke="#1F2937"
        strokeWidth="1"
        opacity="0.2"
      />
      <rect
        x="50"
        y="60"
        width="80"
        height="60"
        rx="6"
        fill="white"
        stroke="#1F2937"
        strokeWidth="1"
      />
      <text
        x="90"
        y="86"
        textAnchor="middle"
        fontWeight="700"
        fontSize="14"
        fill="#1F2937"
        fontFamily="Nunito"
      >
        OLEA
      </text>
      <text
        x="90"
        y="102"
        textAnchor="middle"
        fontSize="9"
        fill="#FF6B5B"
        fontFamily="Nunito"
        fontWeight="600"
      >
        DOĞAL SABUN
      </text>
      <line
        x1="60"
        y1="110"
        x2="120"
        y2="110"
        stroke="#1F2937"
        strokeWidth="0.5"
        opacity="0.3"
      />
      <ellipse cx="90" cy="140" rx="62" ry="14" fill="#1F2937" opacity="0.05" />
    </svg>
  );
}

function StickerPile() {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" aria-hidden>
      <g transform="translate(40 30) rotate(-12)">
        <rect
          width="100"
          height="100"
          rx="20"
          fill="white"
          stroke="#1F2937"
          strokeWidth="1.5"
        />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fontWeight="800"
          fontSize="28"
          fill="#FF6B5B"
          fontFamily="Nunito"
        >
          PİM
        </text>
      </g>
      <g transform="translate(70 50) rotate(8)">
        <circle cx="50" cy="50" r="50" fill="#1F2937" />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fontWeight="800"
          fontSize="22"
          fill="white"
          fontFamily="Nunito"
        >
          YENİ!
        </text>
      </g>
      <g transform="translate(30 80) rotate(15)">
        <path
          d="M50 0 L60 38 L100 38 L68 60 L80 100 L50 75 L20 100 L32 60 L0 38 L40 38 Z"
          fill="#FF9933"
        />
      </g>
    </svg>
  );
}
