/**
 * Pim Etiket — /galeri
 *
 * Müşteri showcase: kim bizden bastı? Hangi marka, hangi ürün?
 * Gerçek görseller backend swap'te admin upload ile gelecek.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Pill } from "@/components/ui";

export const metadata: Metadata = {
  title: "Galeri — Pim Etiket'le bastıran markalar",
  description:
    "Bursa atölyemizden çıkan müşteri işleri. Sticker'dan etikete, küçük markaların raf hikayeleri.",
  alternates: { canonical: "/galeri" },
};

interface ShowcaseItem {
  brand: string;
  product: "sticker" | "etiket";
  description: string;
  config: string;
  bg: string;
}

const SHOWCASE: ShowcaseItem[] = [
  {
    brand: "Olea",
    product: "etiket",
    description: "Doğal sabun serisi — kraft + mat selefon + sıcak yaldız",
    config: "60×80mm · 2.000 adet",
    bg: "bg-krem",
  },
  {
    brand: "Bulutlu Roastery",
    product: "etiket",
    description: "Tek origin kahve etiketleri — beyaz semi-glos + parlak selefon",
    config: "70×100mm · 5.000 adet",
    bg: "bg-[#FFE7D6]",
  },
  {
    brand: "Atölye Niş",
    product: "sticker",
    description: "Etkinlik hediye sticker'ları — holografik vinil",
    config: "75×75mm · 250 adet",
    bg: "bg-pim-mercan-tint",
  },
  {
    brand: "Çiğdem Atölye",
    product: "etiket",
    description: "Tekstil koleksiyonu — ultra clear + spot UV",
    config: "40×60mm · 3.000 adet",
    bg: "bg-yesil-soft",
  },
  {
    brand: "Pop-up Etkinlik",
    product: "sticker",
    description: "Kampanya sticker'ı — vinil + kontur kesim, kalp formu",
    config: "60×60mm · 1.000 adet",
    bg: "bg-sari-soft",
  },
  {
    brand: "Zeytin & Co.",
    product: "etiket",
    description: "Premium zeytinyağı şişesi — metalik gümüş + emboss",
    config: "55×85mm · 1.500 adet",
    bg: "bg-gri-100",
  },
  {
    brand: "Festival Co.",
    product: "sticker",
    description: "Festival giriş sticker'ları — simli vinil",
    config: "50×50mm · 1.000 adet",
    bg: "bg-pim-mercan-tint",
  },
  {
    brand: "Yeşil Yaprak",
    product: "etiket",
    description: "Bitki çayı seti — kraft + soft touch",
    config: "50×70mm · 5.000 adet",
    bg: "bg-krem-soft",
  },
];

export default function GaleriPage() {
  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Hero */}
        <div className="text-center mb-10">
          <Pim pose="excited" size={140} />
          <Eyebrow>Müşteri showcase</Eyebrow>
          <h1 className="mt-3 text-[32px] md:text-[44px] font-semibold tracking-tight leading-tight">
            Pim Etiket&rsquo;le bastıran markalar
          </h1>
          <p className="mt-3 text-base text-gri-700 max-w-[560px] mx-auto leading-relaxed">
            Küçük markalar, büyük hikayeler. Atölyemizden çıkan işlerin bir
            kısmı — izniyle paylaştığımız müşteri çalışmaları.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-[680px] mx-auto">
          {[
            { label: "Toplam baskı", value: "1.2M+", sub: "adet etiket + sticker" },
            { label: "Mutlu marka", value: "2400+", sub: "küçük marka" },
            { label: "Şehir", value: "67", sub: "Türkiye geneli" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                {s.label}
              </div>
              <div className="text-[28px] md:text-[36px] font-bold tracking-tight text-pim-mercan tabular-nums leading-tight mt-1">
                {s.value}
              </div>
              <div className="text-[11.5px] text-gri-500">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SHOWCASE.map((s, i) => (
            <Card key={`${s.brand}-${i}`} padding="" className="!p-0 overflow-hidden hover:-translate-y-0.5 transition-transform">
              <div
                className={`${s.bg} grid place-items-center min-h-[200px] p-6 relative`}
              >
                <div className="text-center">
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-lacivert/60 mb-2">
                    {s.brand}
                  </div>
                  <div className="text-2xl font-bold text-lacivert">
                    {s.brand}
                  </div>
                </div>
                <Pill
                  variant={s.product === "sticker" ? "mercan" : "krem"}
                  className="absolute top-3 right-3"
                >
                  {s.product === "sticker" ? "Sticker" : "Etiket"}
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
                Sıradaki sen ol
              </h2>
              <p className="text-[14px] text-white/75 leading-relaxed max-w-[480px]">
                İlk siparişinde de aynı kalite, aynı hız. Konfigüre et, dosyanı
                yükle, 5-10 günde elinde.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="primary" size="lg" href="/etiket">
                <Icon.Roll size={18} /> Etiket bastır
              </Button>
              <Link
                href="/sticker"
                className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full text-white font-semibold border border-white/30 hover:bg-white/10 transition-colors"
              >
                Sticker bastır
              </Link>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-[12px] text-gri-500 text-center max-w-[640px] mx-auto leading-relaxed">
          Müşteri görselleri yazılı izinle paylaşılır. Markan burada görünsün
          istersen <Link href="/iletisim" className="text-pim-mercan hover:underline">bize yaz</Link>.
        </p>
      </div>
    </main>
  );
}
