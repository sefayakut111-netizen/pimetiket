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
import { gridColsForCount } from "@/lib/grid-cols";

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
    titleTr: "Özel Kesim Rulo Etiket",
    titleEn: "Die-Cut Roll Label",
    descTr: "Logo veya tasarımın silüetine kesim",
    descEn: "Cut to your design's silhouette",
    imageSrc: "/assets/svg/cards/rulo-diecut.svg",
  },
  {
    shape: "clear",
    form: "rulo",
    titleTr: "Şeffaf Rulo Etiket",
    titleEn: "Clear Roll Label",
    descTr: "Saydam zemin — cam şişe, parfüm",
    descEn: "Transparent base — glass bottles, perfume",
    imageSrc: "/assets/svg/cards/rulo-clear.svg",
  },
  {
    shape: "circle",
    form: "rulo",
    titleTr: "Yuvarlak Rulo Etiket",
    titleEn: "Circle Roll Label",
    descTr: "Daire — kapak, kozmetik klasiği",
    descEn: "Circle — cap, cosmetics classic",
    imageSrc: "/assets/svg/cards/rulo-circle.svg",
  },
  {
    shape: "square",
    form: "rulo",
    titleTr: "Kare Rulo Etiket",
    titleEn: "Square Roll Label",
    descTr: "Eş kenar — düz veya yumuşak köşe",
    descEn: "Equal sides — sharp or rounded corner",
    imageSrc: "/assets/svg/cards/rulo-square.svg",
  },
  {
    shape: "rectangle",
    form: "rulo",
    titleTr: "Dikdörtgen Rulo Etiket",
    titleEn: "Rectangle Roll Label",
    descTr: "Yaygın etiket formu — düz veya yumuşak köşe",
    descEn: "Most common label form — sharp or rounded",
    imageSrc: "/assets/svg/cards/rulo-rectangle.svg",
  },
  {
    shape: "oval",
    form: "rulo",
    titleTr: "Oval Rulo Etiket",
    titleEn: "Oval Roll Label",
    descTr: "Elips — vintage, şık duruş",
    descEn: "Ellipse — vintage, elegant",
    imageSrc: "/assets/svg/cards/rulo-oval.svg",
  },
];

const TABAKA_CARDS: EtiketCard[] = [
  {
    shape: "circle",
    form: "tabaka",
    titleTr: "Yuvarlak Tabaka Etiket",
    titleEn: "Circle Sheet Label",
    descTr: "Düşük adet daire — hediye, butik",
    descEn: "Low quantity circles — gifts, boutique",
    imageSrc: "/assets/svg/cards/tabaka-circle.svg",
  },
  {
    shape: "diecut",
    form: "tabaka",
    titleTr: "Özel Kesim Tabaka Etiket",
    titleEn: "Die-Cut Sheet Label",
    descTr: "Düşük adet kontur — el yapımı, butik",
    descEn: "Low quantity contour — handmade, boutique",
    imageSrc: "/assets/svg/cards/tabaka-diecut.svg",
  },
  {
    shape: "oval",
    form: "tabaka",
    titleTr: "Oval Tabaka Etiket",
    titleEn: "Oval Sheet Label",
    descTr: "Düşük adet oval kesim",
    descEn: "Low quantity oval cut",
    imageSrc: "/assets/svg/cards/tabaka-oval.svg",
  },
  {
    shape: "rectangle",
    form: "tabaka",
    titleTr: "Dikdörtgen Tabaka Etiket",
    titleEn: "Rectangle Sheet Label",
    descTr: "Düşük adet — düz veya yumuşak köşe",
    descEn: "Low quantity — sharp or rounded corner",
    imageSrc: "/assets/svg/cards/tabaka-rectangle.svg",
  },
  {
    shape: "square",
    form: "tabaka",
    titleTr: "Kare Tabaka Etiket",
    titleEn: "Square Sheet Label",
    descTr: "Düşük adet — düz veya yumuşak köşe",
    descEn: "Low quantity — sharp or rounded corner",
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
        {/* Header — Sefa 20 May v68: yaratıcı + bilgilendirici alt açıklama. */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-lacivert">
            {isEn ? "Choose your label type" : "Etiket tipini seç"}
          </h1>
          <p className="mt-3 text-[15px] text-gri-700 max-w-2xl mx-auto leading-relaxed">
            {isEn
              ? "Choose the form that becomes your brand's face. Material, size, coating, and quantity — all yours in the next step."
              : "Markanın yüzü olacak formu seç. Sonraki adımda malzeme, boyut, kaplama ve adet — hepsi senin elinde."}
          </p>
        </header>

        {/* Sefa 20 May v68: 2 sütunlu layout — sol RULO, sağ TABAKA.
            lg+: yan yana (2-col), her sütun içinde 2-col kart grid + ortada
            ince dikey ayırıcı çizgi (lg:divide-x).
            sm/md: alt alta (mobile-first), gap ile ayrılır, çizgi yok. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 lg:divide-x lg:divide-gri-200 mb-12">
          {/* SOL SÜTUN — Rulo etiket (6 kart) */}
          <section className="lg:pr-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-gri-200" />
              <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
                {isEn ? "Roll labels" : "Rulo etiket"}
              </h2>
              <div className="h-px flex-1 bg-gri-200" />
            </div>
            <p className="text-center text-[13px] text-gri-700 mb-5 leading-relaxed max-w-md mx-auto">
              {isEn
                ? "Wound on a core, applied quickly by machine. Starts at 1,000 pcs — preferred for serial production in cosmetics, food, beverages."
                : "Bobin halinde sarılı, makineyle hızlıca yapıştırılır. 1.000 adetten başlar — kozmetik, gıda, içecek gibi seri üretimde tercih edilir."}
            </p>
            <div className={`${gridColsForCount(RULO_CARDS.length)} gap-4`}>
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
          <section className="lg:pl-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-gri-200" />
              <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
                {isEn ? "Sheet labels" : "Tabaka etiket"}
              </h2>
              <div className="h-px flex-1 bg-gri-200" />
            </div>
            <p className="text-center text-[13px] text-gri-700 mb-5 leading-relaxed max-w-md mx-auto">
              {isEn
                ? "Comes on sheets, applied by hand. Starts at 250 pcs — ideal for boutique runs, gift packaging, and events."
                : "Sayfa halinde gelir, elle yapıştırılır. 250 adetten başlar — butik tiraj, hediye paketi ve etkinlikler için ideal."}
            </p>
            <div className={`${gridColsForCount(TABAKA_CARDS.length)} gap-4`}>
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
