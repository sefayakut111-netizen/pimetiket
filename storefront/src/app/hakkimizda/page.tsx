/**
 * Pim Etiket — /hakkimizda (E.1.4)
 *
 * Pim hikayesi, Bursa atölyesi, kurucu, değerler.
 * NOT: İçerik şu an placeholder — Sefa nihai metni yazacak.
 * Yapı/component'ler hazır.
 *
 * Client component (i18n hook için). Metadata layout.tsx'te.
 */

"use client";

import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

const COPY = {
  tr: {
    eyebrow: "Hakkımızda",
    h1Line1: "Bursa'dan,",
    h1Line2: "küçük markalar için.",
    intro:
      "Pim Etiket'i kurarken aklımızda tek bir soru vardı: küçük markalar, hayalindeki kalitede etiket bastırmak için neden binlerce adet stoklamak zorunda olsun? Cevabımız bu site.",
    storyEyebrow: "Hikayemiz",
    story1Note: "[Sefa not: bu metni kendi hikayene göre düzenle]",
    story1: " — Pim Etiket, Bursa'da bir atölyede doğdu. Sektörde yıllarını vermiş baskı ustalarıyla, küçük markaların etiket ihtiyaçlarına basit bir cevap aradık. Online konfigürasyon, AI destekli kalite kontrolü ve fason üretim ortaklarıyla esnek bir vitrin kurduk.",
    story2:
      "İlk müşterilerimiz Bursa'daki butik üreticiler oldu — sabun atölyeleri, kavurucular, butik gıda. Onlar bize öğretti: \"hızlı ve doğru\" yetmez, \"esnek ve dürüst\" lazım. Şimdi tüm Türkiye'ye aynı vaatle hizmet ediyoruz.",
    story3pre: "Üretimimizi, sektörde yıllarını vermiş ",
    story3bold: "fason baskı ortaklarımızla",
    story3post:
      " yapıyoruz. Onlar makineyi tanır, biz dijital süreci yönetiriz — müşteri kazanır.",
    valuesEyebrow: "Değerlerimiz",
    valuesTitle: "Pim'in altında saklanan dört söz.",
    val1Title: "Düşük adetten esnek",
    val1Desc:
      "Stoklamadan, az miktarda da kaliteden ödün vermeden bastırırsın. 1000 etiketten başlıyoruz.",
    val2Title: "AI'lı akıllı süreç",
    val2Desc:
      "Pim, dosyanı saniyeler içinde inceler — eksiği varsa söyler. Operatörün gözüyle uzaklaşırsın.",
    val3Title: "Bursa'dan kapına",
    val3Desc:
      "10 günde elinde. Şeffaf üretim takibi, gerçek zamanlı statü, Pim'in haberleri.",
    val4Title: "Açık ve dürüst fiyat",
    val4Desc:
      "Konfigüratörde gördüğün anlık fiyat sepete düştüğünde aynı kalır. Sürpriz ek yok.",
    founderEyebrow: "Kurucu",
    founderTitle: "Merhaba, ben Sefa.",
    founderNote:
      "[Sefa not: kısa bir biyografi + neden bu işi kurduğun + LinkedIn linki]",
    founderText:
      " — Pim Etiket'i kurarken hedefim, sektörün online'a geçişinde küçük markaları kimsenin geride bırakmaması idi. Sen de bizimle çalışmak istersen WhatsApp'tan veya ",
    founderLink: "iletişim",
    founderEnd: " sayfasından bana ulaşabilirsin.",
    ctaTitle: "Bizimle çalışmaya hazır mısın?",
    ctaDesc:
      "İlk siparişin için Pim ile bir tur at. 5 dakikada konfigüre, anında fiyat, gerisi bizden.",
    ctaEtiket: "Etiket bastır",
    ctaSticker: "Sticker bastır",
  },
  en: {
    eyebrow: "About us",
    h1Line1: "From Bursa,",
    h1Line2: "for small brands.",
    intro:
      "When we founded Pim Etiket we had only one question in mind: why should small brands stock thousands of units to print quality labels for their dream products? This site is our answer.",
    storyEyebrow: "Our story",
    story1Note: "[Sefa note: edit this with your own story]",
    story1:
      " — Pim Etiket was born in a Bursa workshop. With print masters who'd spent years in the trade, we looked for a simple answer to small brands' label needs: online configuration, AI-assisted QC, and a flexible storefront powered by contract-print partners.",
    story2:
      "Our first customers were boutique makers in Bursa — soap workshops, coffee roasters, artisan food brands. They taught us: \"fast and accurate\" isn't enough — you need \"flexible and honest.\" Today we serve all of Turkey with the same promise.",
    story3pre: "We do our production with ",
    story3bold: "experienced contract-print partners",
    story3post:
      ". They know the machines, we run the digital workflow — and the customer wins.",
    valuesEyebrow: "Values",
    valuesTitle: "The four promises behind Pim.",
    val1Title: "Flexible from low quantity",
    val1Desc:
      "Print without stocking, no quality compromise even at low volumes. We start from 1000 labels.",
    val2Title: "AI-driven smart workflow",
    val2Desc:
      "Pim reviews your file in seconds — flags what's missing. Like having an experienced operator.",
    val3Title: "From Bursa to your door",
    val3Desc:
      "In your hands within 10 days. Transparent production tracking, real-time status, Pim's updates.",
    val4Title: "Clear and honest pricing",
    val4Desc:
      "The instant price you see in the configurator stays the same in the cart. No hidden fees.",
    founderEyebrow: "Founder",
    founderTitle: "Hi, I'm Sefa.",
    founderNote: "[Sefa note: short bio + why you started + LinkedIn]",
    founderText:
      " — When I founded Pim Etiket, my goal was to make sure no small brand was left behind as the industry moved online. If you want to work with us, you can reach me via WhatsApp or the ",
    founderLink: "contact",
    founderEnd: " page.",
    ctaTitle: "Ready to work with us?",
    ctaDesc:
      "Take a quick tour with Pim for your first order. 5-minute config, instant pricing, the rest is on us.",
    ctaEtiket: "Print labels",
    ctaSticker: "Print stickers",
  },
};

export default function HakkimizdaPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const VALUES = [
    { icon: <Icon.Bolt size={22} />, t: c.val1Title, d: c.val1Desc },
    { icon: <Icon.Sparkle size={22} />, t: c.val2Title, d: c.val2Desc },
    { icon: <Icon.Truck size={22} />, t: c.val3Title, d: c.val3Desc },
    { icon: <Icon.Wallet size={22} />, t: c.val4Title, d: c.val4Desc },
  ];

  return (
    <main className="animate-fade-up">
      {/* HERO */}
      <section className="relative overflow-hidden pt-10 md:pt-16 pb-14 md:pb-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 420px at 78% 25%, var(--color-krem) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 md:gap-10 items-center">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-5 text-[34px] md:text-[56px] leading-[1.04] font-semibold tracking-[-0.02em]">
              {c.h1Line1}
              <br />
              {c.h1Line2}
            </h1>
            <p className="mt-6 text-[15px] md:text-lg text-gri-700 max-w-[540px] leading-relaxed">
              {c.intro}
            </p>
          </div>
          <div className="hidden md:block shrink-0">
            <Pim pose="happy" size={220} />
          </div>
        </div>
      </section>

      {/* HİKAYE */}
      <section className="py-10 md:py-12">
        <div className="mx-auto max-w-[800px] px-4 md:px-8">
          <Eyebrow>{c.storyEyebrow}</Eyebrow>
          <div className="mt-4 space-y-5 text-base text-gri-700 leading-[1.7]">
            <p>
              <strong className="text-lacivert">{c.story1Note}</strong>
              {c.story1}
            </p>
            <p>{c.story2}</p>
            <p>
              {c.story3pre}
              <strong className="text-lacivert">{c.story3bold}</strong>
              {c.story3post}
            </p>
          </div>
        </div>
      </section>

      {/* DEĞERLER */}
      <section className="py-10 md:py-12 bg-gri-50">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="text-center mb-10 md:mb-12">
            <Eyebrow>{c.valuesEyebrow}</Eyebrow>
            <h2 className="mt-4 text-[24px] md:text-[40px] font-semibold tracking-tight leading-tight max-w-[640px] mx-auto">
              {c.valuesTitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[900px] mx-auto">
            {VALUES.map((v, i) => (
              <Card key={i} padding="p-6 md:p-7">
                <div className="grid place-items-center w-11 h-11 rounded-xl bg-pim-mercan-tint text-pim-mercan mb-4">
                  {v.icon}
                </div>
                <h3 className="text-lg md:text-xl font-semibold leading-snug mb-1.5">
                  {v.t}
                </h3>
                <p className="text-[15px] md:text-base text-gri-700 leading-relaxed">
                  {v.d}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* KURUCU */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-[800px] px-4 md:px-8">
          <div className="bg-krem rounded-2xl p-6 md:p-12 ring-1 ring-black/[0.04]">
            <Eyebrow>{c.founderEyebrow}</Eyebrow>
            <h2 className="mt-4 text-[24px] md:text-[36px] font-semibold tracking-tight leading-tight">
              {c.founderTitle}
            </h2>
            <p className="mt-5 text-[15px] md:text-base text-gri-700 leading-[1.7]">
              <strong className="text-lacivert">{c.founderNote}</strong>
              {c.founderText}
              <a
                href="/iletisim"
                className="text-pim-mercan font-semibold hover:underline"
              >
                {c.founderLink}
              </a>
              {c.founderEnd}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="relative overflow-hidden bg-lacivert text-white rounded-[32px] px-6 md:px-14 py-10 md:py-14">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="relative grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 md:gap-8 items-center">
              <div>
                <h2 className="text-2xl md:text-4xl font-semibold tracking-tight leading-tight">
                  {c.ctaTitle}
                </h2>
                <p className="mt-3 text-[15px] md:text-base text-white/75 max-w-[480px] leading-relaxed">
                  {c.ctaDesc}
                </p>
                <div className="mt-6 flex gap-3 flex-wrap">
                  <Button variant="primary" size="lg" href="/etiket">
                    <Icon.Roll size={18} /> {c.ctaEtiket}
                  </Button>
                  <Button variant="primary" size="lg" href="/sticker">
                    <Icon.Sticker size={18} /> {c.ctaSticker}
                  </Button>
                </div>
              </div>
              <div className="hidden md:flex justify-center">
                <Pim pose="excited" size={180} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
