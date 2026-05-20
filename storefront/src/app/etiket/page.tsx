/**
 * /etiket — Görsel ürün filtresi (StickerMule pattern).
 *
 * Sefa 20 May v68 (Konfigüratör reform Aşama A + grid v2 + SVG yenileme):
 * 2 section: üst Rulo etiket (6 şekil), alt Tabaka etiket (5 şekil).
 * Tıkla → /etiket/yapilandir?form=...&shape=...
 *
 * Görsel mimari (Sefa kararı 20 May):
 *   - `imageSrc` field: public/assets/svg/cards/*.svg path
 *   - SVG → inline render değil, <img src=...> ile yüklenir (cache + lazy)
 *   - İleride Midjourney PNG üretilince sadece imageSrc path değişir
 *     (örn /assets/svg/cards/rulo-circle.svg → /etiket-cards/rulo-circle.png)
 *   - SVG asset stili: mevcut roll-icon.svg + surfaces/ standardıyla uyumlu
 *     (gradient + drop shadow + 3D perspektif + brand mercan)
 *
 * Tasarım kararları:
 *   - Hover'da pim-mercan border + shadow (Sefa pattern)
 *   - 4-col md, 2-col sm, 1-col mobile
 *   - "Aradığını bulamadın mı?" CTA altta — sticker'a yönlendirir
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

interface EtiketCard {
  /** URL query param: shape */
  shape: string;
  /** URL query param: form ("rulo" | "tabaka") */
  form: "rulo" | "tabaka";
  /** TR başlık */
  titleTr: string;
  /** EN başlık */
  titleEn: string;
  /** Açıklama TR */
  descTr: string;
  /** Açıklama EN */
  descEn: string;
  /** Görsel path (SVG veya ileride PNG) — public/'tan göreceli */
  imageSrc: string;
}

// ============================================================
// Kart verisi — 11 kart toplam (6 rulo + 5 tabaka)
// ============================================================

const RULO_CARDS: EtiketCard[] = [
  {
    shape: "diecut",
    form: "rulo",
    titleTr: "Özel kesim rulo",
    titleEn: "Die-cut roll",
    descTr: "Her forma kontur kesim",
    descEn: "Custom contour cut",
    imageSrc: "/assets/svg/cards/rulo-diecut.svg",
  },
  {
    shape: "clear",
    form: "rulo",
    titleTr: "Şeffaf rulo",
    titleEn: "Clear roll",
    descTr: "Transparan/şeffaf zemin",
    descEn: "Transparent labels",
    imageSrc: "/assets/svg/cards/rulo-clear.svg",
  },
  {
    shape: "circle",
    form: "rulo",
    titleTr: "Yuvarlak rulo",
    titleEn: "Circle roll",
    descTr: "Standart daire etiket",
    descEn: "Round labels",
    imageSrc: "/assets/svg/cards/rulo-circle.svg",
  },
  {
    shape: "square",
    form: "rulo",
    titleTr: "Kare rulo",
    titleEn: "Square roll",
    descTr: "Eş kenarlı kare",
    descEn: "Square labels",
    imageSrc: "/assets/svg/cards/rulo-square.svg",
  },
  {
    shape: "rectangle",
    form: "rulo",
    titleTr: "Dikdörtgen rulo",
    titleEn: "Rectangle roll",
    descTr: "Klasik dikdörtgen — düz veya yumuşak köşe",
    descEn: "Rectangle — sharp or rounded corner",
    imageSrc: "/assets/svg/cards/rulo-rectangle.svg",
  },
  {
    shape: "oval",
    form: "rulo",
    titleTr: "Oval rulo",
    titleEn: "Oval roll",
    descTr: "Oval/elips etiket",
    descEn: "Oval labels",
    imageSrc: "/assets/svg/cards/rulo-oval.svg",
  },
];

const TABAKA_CARDS: EtiketCard[] = [
  {
    shape: "circle",
    form: "tabaka",
    titleTr: "Yuvarlak tabaka",
    titleEn: "Circle sheet labels",
    descTr: "Tabaka üstü daire kesim",
    descEn: "Round labels on sheet",
    imageSrc: "/assets/svg/cards/tabaka-circle.svg",
  },
  {
    shape: "diecut",
    form: "tabaka",
    titleTr: "Özel kesim tabaka",
    titleEn: "Die-cut sheet labels",
    descTr: "Tabaka üstü kontur kesim",
    descEn: "Contour cut on sheet",
    imageSrc: "/assets/svg/cards/tabaka-diecut.svg",
  },
  {
    shape: "oval",
    form: "tabaka",
    titleTr: "Oval tabaka",
    titleEn: "Oval sheet labels",
    descTr: "Tabaka üstü oval",
    descEn: "Oval labels on sheet",
    imageSrc: "/assets/svg/cards/tabaka-oval.svg",
  },
  {
    shape: "rectangle",
    form: "tabaka",
    titleTr: "Dikdörtgen tabaka",
    titleEn: "Rectangle sheet labels",
    descTr: "Tabaka üstü dikdörtgen — düz veya yumuşak köşe",
    descEn: "Rectangle on sheet — sharp or rounded",
    imageSrc: "/assets/svg/cards/tabaka-rectangle.svg",
  },
  {
    shape: "square",
    form: "tabaka",
    titleTr: "Kare tabaka",
    titleEn: "Square sheet labels",
    descTr: "Tabaka üstü kare",
    descEn: "Square labels on sheet",
    imageSrc: "/assets/svg/cards/tabaka-square.svg",
  },
];

// ============================================================
// Tek kart component — DRY
// ============================================================

function ProductCard({
  card,
  isEn,
}: {
  card: EtiketCard;
  isEn: boolean;
}) {
  return (
    <Link
      href={`/etiket/yapilandir?form=${card.form}&shape=${card.shape}`}
      className="group block bg-white rounded-2xl border border-gri-200 hover:border-pim-mercan hover:shadow-lg transition-all duration-150 p-4 focus:outline-none focus:ring-2 focus:ring-pim-mercan focus:ring-offset-2"
    >
      {/* Sefa 20 May v68: aspect-[220/130] reservation → CLS=0.
          Next/Image otomatik AVIF/WebP + srcset + lazy. Sizes prop ile
          mobile'da 50vw, tablet 33vw, desktop 25vw (4-col grid). */}
      <div className="relative bg-gri-50 group-hover:bg-pim-mercan-tint/30 rounded-xl mb-3 transition-colors aspect-[220/130] overflow-hidden">
        <Image
          src={card.imageSrc}
          alt={isEn ? card.titleEn : card.titleTr}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
          className="object-contain p-3"
        />
      </div>
      <h3 className="text-base font-semibold text-lacivert group-hover:text-pim-mercan transition-colors">
        {isEn ? card.titleEn : card.titleTr}
      </h3>
      <p className="text-sm text-gri-600 mt-1">
        {isEn ? card.descEn : card.descTr}
      </p>
    </Link>
  );
}

// ============================================================
// Sayfa component
// ============================================================

export default function EtiketGridPage() {
  const { locale } = useT();
  const isEn = locale === "en";

  return (
    <main className="min-h-screen bg-gri-50 pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header — Sefa 20 May v68: alt açıklama paragrafı kaldırıldı,
            başlık tek başına yeterli. */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-lacivert">
            {isEn ? "Choose your label type" : "Etiket tipini seç"}
          </h1>
        </header>

        {/* Sefa 20 May v68: 2 sütunlu layout — sol RULO, sağ TABAKA.
            lg+: yan yana (2-col), her sütun içinde 2-col kart grid.
            sm/md: alt alta (mobile-first). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-12">
          {/* SOL SÜTUN — Rulo etiket (6 kart) */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gri-200" />
              <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
                {isEn ? "Roll labels" : "Rulo etiket"}
              </h2>
              <div className="h-px flex-1 bg-gri-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {RULO_CARDS.map((card) => (
                <ProductCard
                  key={`${card.form}-${card.shape}`}
                  card={card}
                  isEn={isEn}
                />
              ))}
            </div>
          </section>

          {/* SAĞ SÜTUN — Tabaka etiket (5 kart) */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gri-200" />
              <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
                {isEn ? "Sheet labels" : "Tabaka etiket"}
              </h2>
              <div className="h-px flex-1 bg-gri-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TABAKA_CARDS.map((card) => (
                <ProductCard
                  key={`${card.form}-${card.shape}`}
                  card={card}
                  isEn={isEn}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Alt CTA — sticker yönlendirme */}
        <div className="mt-12 text-center">
          <p className="text-gri-700 text-sm">
            {isEn ? "Looking for stickers instead?" : "Sticker mı arıyorsun?"}{" "}
            <Link
              href="/sticker"
              className="text-pim-mercan font-semibold underline underline-offset-2 hover:decoration-2"
            >
              {isEn ? "Browse stickers" : "Sticker sayfasına git"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
