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

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import type { ProductCard as DbProductCard } from "@/lib/product-cards";

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

/**
 * DB'den gelen ProductCard → mevcut UI EtiketCard formatı.
 * Sefa 21 May v68 Mig 074: admin değişiklikleri burada yansır.
 */
function dbCardToEtiketCard(db: DbProductCard): EtiketCard | null {
  const form = (db.query_params.form as "rulo" | "tabaka") ?? "rulo";
  const shape = (db.query_params.shape as string) ?? "diecut";
  if (!db.image_src) return null;
  return {
    shape,
    form,
    titleTr: db.title_tr,
    titleEn: db.title_en,
    descTr: db.desc_tr,
    descEn: db.desc_en,
    imageSrc: db.image_src,
  };
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
    // Sefa 22 May v68: SVG silüetler yerine gerçek illüstrasyon PNG'leri
    imageSrc: "/assets/img/cards/rulo-diecut.jpg",
  },
  {
    shape: "clear",
    form: "rulo",
    titleTr: "Şeffaf Rulo Etiket",
    titleEn: "Clear Roll Label",
    descTr: "Saydam zemin — cam şişe, parfüm",
    descEn: "Transparent base — glass bottles, perfume",
    imageSrc: "/assets/img/cards/rulo-clear.jpg",
  },
  {
    shape: "circle",
    form: "rulo",
    titleTr: "Yuvarlak Rulo Etiket",
    titleEn: "Circle Roll Label",
    descTr: "Daire — kapak, kozmetik klasiği",
    descEn: "Circle — cap, cosmetics classic",
    imageSrc: "/assets/img/cards/rulo-circle.jpg",
  },
  {
    shape: "square",
    form: "rulo",
    titleTr: "Kare Rulo Etiket",
    titleEn: "Square Roll Label",
    descTr: "Eş kenar — düz veya yumuşak köşe",
    descEn: "Equal sides — sharp or rounded corner",
    imageSrc: "/assets/img/cards/rulo-square.jpg",
  },
  {
    shape: "rectangle",
    form: "rulo",
    titleTr: "Dikdörtgen Rulo Etiket",
    titleEn: "Rectangle Roll Label",
    descTr: "Yaygın etiket formu — düz veya yumuşak köşe",
    descEn: "Most common label form — sharp or rounded",
    imageSrc: "/assets/img/cards/rulo-rectangle.jpg",
  },
  {
    shape: "oval",
    form: "rulo",
    titleTr: "Oval Rulo Etiket",
    titleEn: "Oval Roll Label",
    descTr: "Elips — vintage, şık duruş",
    descEn: "Ellipse — vintage, elegant",
    imageSrc: "/assets/img/cards/rulo-oval.jpg",
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
    imageSrc: "/assets/img/cards/tabaka-circle.jpg",
  },
  {
    shape: "diecut",
    form: "tabaka",
    titleTr: "Özel Kesim Tabaka Etiket",
    titleEn: "Die-Cut Sheet Label",
    descTr: "Düşük adet kontur — el yapımı, butik",
    descEn: "Low quantity contour — handmade, boutique",
    // Sefa 22 May v68: 21.11.29 (çıplak Pim silüetli) tercih edildi.
    // 21.14.25 (outline'lı) tabaka-diecut-alt.png olarak yedek kalıyor.
    imageSrc: "/assets/img/cards/tabaka-diecut.jpg",
  },
  {
    shape: "oval",
    form: "tabaka",
    titleTr: "Oval Tabaka Etiket",
    titleEn: "Oval Sheet Label",
    descTr: "Düşük adet oval kesim",
    descEn: "Low quantity oval cut",
    imageSrc: "/assets/img/cards/tabaka-oval.jpg",
  },
  {
    shape: "rectangle",
    form: "tabaka",
    titleTr: "Dikdörtgen Tabaka Etiket",
    titleEn: "Rectangle Sheet Label",
    descTr: "Düşük adet — düz veya yumuşak köşe",
    descEn: "Low quantity — sharp or rounded corner",
    imageSrc: "/assets/img/cards/tabaka-rectangle.jpg",
  },
  {
    shape: "square",
    form: "tabaka",
    titleTr: "Kare Tabaka Etiket",
    titleEn: "Square Sheet Label",
    descTr: "Düşük adet — düz veya yumuşak köşe",
    descEn: "Low quantity — sharp or rounded corner",
    imageSrc: "/assets/img/cards/tabaka-square.jpg",
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
      {/* Sefa 20 May v68: aspect reservation → CLS=0.
          Sefa 22 May v68: 220/130 (1.69) → 3/2 (1.5) — Sefa'nın illüstrasyon
          PNG'leri ~3:2 oran, kutu uygun. object-contain → object-cover +
          padding kaldırıldı → görsel kart'a tam sığar, daha "premium" his. */}
      <div className="relative bg-gri-50 group-hover:bg-pim-mercan-tint/30 rounded-xl mb-3 transition-colors aspect-[3/2] overflow-hidden">
        <Image
          src={card.imageSrc}
          alt={isEn ? card.titleEn : card.titleTr}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
          className="object-cover"
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

  // Sefa 21 May v68 Mig 074: DB'den admin yönetimli kartlar.
  // İlk render fallback (hardcoded RULO_CARDS/TABAKA_CARDS) ile başlar
  // — flicker yok, hidrate olunca DB değerleri ile değiştirilir.
  const [ruloCards, setRuloCards] = useState<EtiketCard[]>(RULO_CARDS);
  const [tabakaCards, setTabakaCards] = useState<EtiketCard[]>(TABAKA_CARDS);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/product-cards?product_type=etiket", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || !Array.isArray(j.cards) || j.cards.length === 0) {
          return;
        }
        const cards = (j.cards as DbProductCard[])
          .map(dbCardToEtiketCard)
          .filter((c): c is EtiketCard => c !== null);
        // Sefa 21 May v68 (site denetim P0 #1): DB INSERT'lerinde Türkçe
        // karakter bozuk geldiyse (U+FFFD replacement char veya bozuk
        // mojibake "�") fallback hardcoded array'i kullan, kullanıcıya
        // bozuk metin gösterme.
        const hasBrokenEncoding = cards.some((c) => /[�]/.test(c.titleTr) || /[�]/.test(c.descTr));
        if (hasBrokenEncoding) {
          console.warn("[etiket] DB kart metinlerinde bozuk karakter — fallback kullanılıyor");
          return;
        }
        const rulo = cards.filter((c) => c.form === "rulo");
        const tabaka = cards.filter((c) => c.form === "tabaka");
        if (rulo.length > 0) setRuloCards(rulo);
        if (tabaka.length > 0) setTabakaCards(tabaka);
      })
      .catch(() => {
        /* DB fail → fallback hardcoded kalır */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ruloCards.map((card) => (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tabakaCards.map((card) => (
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
