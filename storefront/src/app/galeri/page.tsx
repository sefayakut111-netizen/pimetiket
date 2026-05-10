/**
 * Pim Etiket — /galeri
 *
 * Müşteri showcase: kim bizden bastı? Hangi marka, hangi ürün?
 * Gerçek görseller backend swap'te admin upload ile gelecek.
 */

"use client";

import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Pill } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import {
  GalleryMockup,
  type MockupVariant,
} from "@/components/GalleryMockup";

interface ShowcaseItem {
  brand: string;
  product: "sticker" | "etiket";
  description: string;
  config: string;
  bg: string;
  /** Hangi mockup template'i — şişe / kahve / laptop / vb */
  mockup: MockupVariant;
  /** Etiket renk paleti (mockup içinde) */
  labelBg?: string;
  labelColor?: string;
  sceneBg?: string;
}

const COPY = {
  tr: {
    eyebrow: "Müşteri showcase",
    title: "Pim Etiket'le bastıran markalar",
    intro:
      "Küçük markalar, büyük hikayeler. Atölyemizden çıkan işlerin bir kısmı — izniyle paylaştığımız müşteri çalışmaları.",
    statTotal: "Toplam baskı",
    statTotalSub: "adet etiket + sticker",
    statBrand: "Mutlu marka",
    statBrandSub: "küçük marka",
    statCity: "Şehir",
    statCitySub: "Türkiye geneli",
    productSticker: "Sticker",
    productEtiket: "Etiket",
    ctaTitle: "Sıradaki sen ol",
    ctaDesc:
      "İlk siparişinde de aynı kalite, aynı hız. Konfigüre et, dosyanı yükle, 10 günde elinde.",
    ctaPrimary: "Etiket bastır",
    ctaSecondary: "Sticker bastır",
    permission: (
      <>
        Müşteri görselleri yazılı izinle paylaşılır. Markan burada görünsün
        istersen{" "}
        <Link href="/iletisim" className="text-pim-mercan hover:underline">
          bize yaz
        </Link>
        .
      </>
    ),
    items: [
      {
        brand: "Olea",
        product: "etiket",
        description:
          "Doğal sabun serisi — kraft + mat selefon + sıcak yaldız",
        config: "60×80mm · 2.000 adet",
        bg: "bg-krem",
        mockup: "bottle",
        labelBg: "#F5EBD9",
        labelColor: "#3D2E1A",
        sceneBg: "linear-gradient(135deg,#FFF5EB 0%,#F5DBC4 100%)",
      },
      {
        brand: "Bulutlu Roastery",
        product: "etiket",
        description:
          "Tek origin kahve etiketleri — beyaz semi-glos + parlak selefon",
        config: "70×100mm · 5.000 adet",
        bg: "bg-[#FFE7D6]",
        mockup: "coffee",
        labelBg: "#FFF8F0",
        labelColor: "#3F2E26",
        sceneBg: "linear-gradient(135deg,#FFE7D6 0%,#E8C9A0 100%)",
      },
      {
        brand: "Atölye Niş",
        product: "sticker",
        description: "Etkinlik hediye sticker'ları — holografik vinil",
        config: "75×75mm · 250 adet",
        bg: "bg-pim-mercan-tint",
        mockup: "round",
        labelBg: "#FFFFFF",
        labelColor: "#1F2335",
        sceneBg: "linear-gradient(135deg,#FFE3D2 0%,#FFB7E5 100%)",
      },
      {
        brand: "Çiğdem Atölye",
        product: "etiket",
        description: "Tekstil koleksiyonu — ultra clear + spot UV",
        config: "40×60mm · 3.000 adet",
        bg: "bg-yesil-soft",
        mockup: "tube",
        labelBg: "#FFF5EB",
        labelColor: "#1F2335",
        sceneBg: "linear-gradient(135deg,#D6F0D0 0%,#B7E8D9 100%)",
      },
      {
        brand: "Pop-up Etkinlik",
        product: "sticker",
        description: "Kampanya sticker'ı — vinil + kontur kesim, kalp formu",
        config: "60×60mm · 1.000 adet",
        bg: "bg-sari-soft",
        mockup: "laptop",
        labelBg: "#FFE3D2",
        labelColor: "#1F2335",
        sceneBg: "linear-gradient(135deg,#FFF6CC 0%,#FFE08A 100%)",
      },
      {
        brand: "Zeytin & Co.",
        product: "etiket",
        description: "Premium zeytinyağı şişesi — metalik gümüş + emboss",
        config: "55×85mm · 1.500 adet",
        bg: "bg-gri-100",
        mockup: "olive",
        labelBg: "#1F2335",
        labelColor: "#E5E9EE",
        sceneBg: "linear-gradient(135deg,#E5E9EE 0%,#9BA4AD 100%)",
      },
      {
        brand: "Festival Co.",
        product: "sticker",
        description: "Festival giriş sticker'ları — simli vinil",
        config: "50×50mm · 1.000 adet",
        bg: "bg-pim-mercan-tint",
        mockup: "round",
        labelBg: "#1F2335",
        labelColor: "#FFE08A",
        sceneBg: "linear-gradient(135deg,#FFB7E5 0%,#B7E8FF 50%,#FFE8B7 100%)",
      },
      {
        brand: "Yeşil Yaprak",
        product: "etiket",
        description: "Bitki çayı seti — kraft + soft touch",
        config: "50×70mm · 5.000 adet",
        bg: "bg-krem-soft",
        mockup: "tea",
        labelBg: "#FFF5EB",
        labelColor: "#1F4A2F",
        sceneBg: "linear-gradient(135deg,#FFF5EB 0%,#D6F0D0 100%)",
      },
    ] as ShowcaseItem[],
  },
  en: {
    eyebrow: "Customer showcase",
    title: "Brands that print with Pim Etiket",
    intro:
      "Small brands, big stories. A glimpse of work from our workshop — customer projects we share with their permission.",
    statTotal: "Total prints",
    statTotalSub: "labels + stickers",
    statBrand: "Happy brands",
    statBrandSub: "small brands",
    statCity: "Cities",
    statCitySub: "across Turkey",
    productSticker: "Sticker",
    productEtiket: "Label",
    ctaTitle: "Be the next one",
    ctaDesc:
      "Same quality, same speed on your first order. Configure, upload, in your hands in 5-10 days.",
    ctaPrimary: "Print labels",
    ctaSecondary: "Print stickers",
    permission: (
      <>
        Customer photos are shared only with written consent. Want your brand
        here?{" "}
        <Link href="/iletisim" className="text-pim-mercan hover:underline">
          Reach out
        </Link>
        .
      </>
    ),
    items: [
      {
        brand: "Olea",
        product: "etiket",
        description:
          "Natural soap line — kraft + matte lamination + hot foil stamp",
        config: "60×80mm · 2,000 pcs",
        bg: "bg-krem",
        mockup: "bottle",
        labelBg: "#F5EBD9",
        labelColor: "#3D2E1A",
        sceneBg: "linear-gradient(135deg,#FFF5EB 0%,#F5DBC4 100%)",
      },
      {
        brand: "Bulutlu Roastery",
        product: "etiket",
        description:
          "Single-origin coffee labels — white semi-gloss + glossy lamination",
        config: "70×100mm · 5,000 pcs",
        bg: "bg-[#FFE7D6]",
        mockup: "coffee",
        labelBg: "#FFF8F0",
        labelColor: "#3F2E26",
        sceneBg: "linear-gradient(135deg,#FFE7D6 0%,#E8C9A0 100%)",
      },
      {
        brand: "Atölye Niş",
        product: "sticker",
        description: "Event giveaway stickers — holographic vinyl",
        config: "75×75mm · 250 pcs",
        bg: "bg-pim-mercan-tint",
        mockup: "round",
        labelBg: "#FFFFFF",
        labelColor: "#1F2335",
        sceneBg: "linear-gradient(135deg,#FFE3D2 0%,#FFB7E5 100%)",
      },
      {
        brand: "Çiğdem Atölye",
        product: "etiket",
        description: "Textile collection — ultra clear + spot UV",
        config: "40×60mm · 3,000 pcs",
        bg: "bg-yesil-soft",
        mockup: "tube",
        labelBg: "#FFF5EB",
        labelColor: "#1F2335",
        sceneBg: "linear-gradient(135deg,#D6F0D0 0%,#B7E8D9 100%)",
      },
      {
        brand: "Pop-up Etkinlik",
        product: "sticker",
        description: "Campaign sticker — vinyl + contour cut, heart shape",
        config: "60×60mm · 1,000 pcs",
        bg: "bg-sari-soft",
        mockup: "laptop",
        labelBg: "#FFE3D2",
        labelColor: "#1F2335",
        sceneBg: "linear-gradient(135deg,#FFF6CC 0%,#FFE08A 100%)",
      },
      {
        brand: "Zeytin & Co.",
        product: "etiket",
        description: "Premium olive oil bottle — metallic silver + embossed",
        config: "55×85mm · 1,500 pcs",
        bg: "bg-gri-100",
        mockup: "olive",
        labelBg: "#1F2335",
        labelColor: "#E5E9EE",
        sceneBg: "linear-gradient(135deg,#E5E9EE 0%,#9BA4AD 100%)",
      },
      {
        brand: "Festival Co.",
        product: "sticker",
        description: "Festival entry stickers — glitter vinyl",
        config: "50×50mm · 1,000 pcs",
        bg: "bg-pim-mercan-tint",
        mockup: "round",
        labelBg: "#1F2335",
        labelColor: "#FFE08A",
        sceneBg: "linear-gradient(135deg,#FFB7E5 0%,#B7E8FF 50%,#FFE8B7 100%)",
      },
      {
        brand: "Yeşil Yaprak",
        product: "etiket",
        description: "Herbal tea set — kraft + soft touch",
        config: "50×70mm · 5,000 pcs",
        bg: "bg-krem-soft",
        mockup: "tea",
        labelBg: "#FFF5EB",
        labelColor: "#1F4A2F",
        sceneBg: "linear-gradient(135deg,#FFF5EB 0%,#D6F0D0 100%)",
      },
    ] as ShowcaseItem[],
  },
};

export default function GaleriPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Hero */}
        <div className="text-center mb-8">
          <Pim pose="excited" size={140} />
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[32px] md:text-[44px] font-semibold tracking-tight leading-tight">
            {c.title}
          </h1>
          <p className="mt-3 text-base text-gri-700 max-w-[560px] mx-auto leading-relaxed">
            {c.intro}
          </p>
        </div>

        {/* Demo disclaimer — gerçek müşteri görselleri gelene kadar */}
        <div className="rounded-2xl bg-pim-mercan-tint ring-1 ring-pim-mercan/20 px-5 py-4 mb-8 max-w-[820px] mx-auto flex items-start gap-3">
          <Icon.Info size={16} className="text-pim-mercan mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-[13.5px] text-pim-mercan mb-0.5">
              Aşağıdaki görseller konsept tasarımlardır
            </div>
            <p className="text-[12.5px] text-pim-mercan/85 leading-relaxed">
              Pim Etiket henüz yeni — ilk siparişler tamamlanıp müşteriler yazılı izin verdikçe gerçek baskı görselleri buraya gelecek.{" "}
              <Link
                href="/iletisim"
                className="font-semibold underline underline-offset-2"
              >
                Markan ilk olsun istersen yaz
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {c.items.map((s, i) => (
            <Card
              key={`${s.brand}-${i}`}
              padding=""
              className="!p-0 overflow-hidden hover:-translate-y-0.5 transition-transform"
            >
              <div className="relative min-h-[260px] p-4">
                <GalleryMockup
                  variant={s.mockup}
                  brandName={s.brand}
                  labelBg={s.labelBg}
                  labelColor={s.labelColor}
                  sceneBg={s.sceneBg}
                />
                <span className="absolute top-3 left-3 inline-flex items-center px-2 h-[20px] rounded-full bg-white/90 text-gri-700 text-[10px] font-bold uppercase tracking-[0.04em] ring-1 ring-gri-200">
                  Konsept
                </span>
                <Pill
                  variant={s.product === "sticker" ? "mercan" : "krem"}
                  className="absolute top-3 right-3"
                >
                  {s.product === "sticker" ? c.productSticker : c.productEtiket}
                </Pill>
              </div>
              <div className="p-5">
                <p className="text-[14px] text-gri-700 leading-relaxed mb-2">
                  {s.description}
                </p>
                <div className="text-[12px] text-gri-500 tabular-nums">
                  {s.config}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <Card padding="p-8" className="mt-10 !bg-lacivert !text-white">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
                {c.ctaTitle}
              </h2>
              <p className="text-[14px] text-white/75 leading-relaxed max-w-[480px]">
                {c.ctaDesc}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="primary" size="lg" href="/etiket">
                <Icon.Roll size={18} /> {c.ctaPrimary}
              </Button>
              <Link
                href="/sticker"
                className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full text-white font-semibold border border-white/30 hover:bg-white/10 transition-colors"
              >
                {c.ctaSecondary}
              </Link>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-[12px] text-gri-500 text-center max-w-[640px] mx-auto leading-relaxed">
          {c.permission}
        </p>
      </div>
    </main>
  );
}
