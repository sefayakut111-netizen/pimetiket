"use client";

import Link from "next/link";
import Image from "next/image";
import { ETIKET_RULO_ENABLED } from "@/lib/etiket-feature-flags";

interface HomePopularProductsProps {
  locale: string;
}

interface PopularProduct {
  href: string;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  imageSrc: string;
  /** Rulo etiketler 29 Haziran'a kadar kapalı — flag açılınca otomatik aktifleşir */
  comingSoon?: boolean;
}

// Elle seçili "popüler" sticker'lar — hepsi aktif (/sticker/yapilandir).
const STICKER_POPULAR: PopularProduct[] = [
  {
    href: "/sticker/yapilandir?cut=diecut&shape=diecut",
    titleTr: "Özel Kesim Sticker",
    titleEn: "Die-Cut Sticker",
    descTr: "Tasarımın silüetine göre kesim",
    descEn: "Cut to your design's silhouette",
    imageSrc: "/assets/img/cards/sticker-diecut.jpg",
  },
  {
    href: "/sticker/yapilandir?cut=diecut&shape=circle",
    titleTr: "Yuvarlak Sticker",
    titleEn: "Circle Sticker",
    descTr: "Laptop, şişe, marka için klasik daire",
    descEn: "Classic circle for laptops, bottles, brands",
    imageSrc: "/assets/img/cards/sticker-circle.jpg",
  },
  {
    href: "/sticker/yapilandir?cut=diecut&shape=rectangle",
    titleTr: "Dikdörtgen Sticker",
    titleEn: "Rectangle Sticker",
    descTr: "En yaygın form — düz veya yumuşak köşe",
    descEn: "Most common form — sharp or rounded corner",
    imageSrc: "/assets/img/cards/sticker-rectangle.jpg",
  },
  {
    href: "/sticker/yapilandir?cut=diecut&shape=diecut&material=holo",
    titleTr: "Holografik Sticker",
    titleEn: "Holographic Sticker",
    descTr: "Işıkta renk değiştiren premium parlaklık",
    descEn: "Premium rainbow shine in the light",
    imageSrc: "/assets/img/cards/sticker-hologram.jpg",
  },
];

// 2 tabaka (aktif) + 2 rulo ("Yakında" — ETIKET_RULO_ENABLED açılınca tıklanır).
const ETIKET_POPULAR: PopularProduct[] = [
  {
    href: "/etiket/yapilandir?form=tabaka&shape=circle",
    titleTr: "Yuvarlak Tabaka Etiket",
    titleEn: "Circle Sheet Label",
    descTr: "Düşük adet daire — kavanoz, butik",
    descEn: "Low-quantity circles — jars, boutique",
    imageSrc: "/assets/img/cards/tabaka-circle.jpg",
  },
  {
    href: "/etiket/yapilandir?form=tabaka&shape=rectangle",
    titleTr: "Dikdörtgen Tabaka Etiket",
    titleEn: "Rectangle Sheet Label",
    descTr: "Düşük adet — düz veya yumuşak köşe",
    descEn: "Low quantity — sharp or rounded corner",
    imageSrc: "/assets/img/cards/tabaka-rectangle.jpg",
  },
  {
    href: "/etiket/yapilandir?form=rulo&shape=diecut",
    titleTr: "Özel Kesim Rulo Etiket",
    titleEn: "Die-Cut Roll Label",
    descTr: "Seri üretim için kontur kesim rulo",
    descEn: "Contour-cut roll for volume production",
    imageSrc: "/assets/img/cards/rulo-diecut.jpg",
    comingSoon: !ETIKET_RULO_ENABLED,
  },
  {
    href: "/etiket/yapilandir?form=rulo&shape=clear",
    titleTr: "Şeffaf Rulo Etiket",
    titleEn: "Clear Roll Label",
    descTr: "Cam/PET'e basılı gibi şeffaf rulo",
    descEn: "Clear roll — 'printed-on' look on glass/PET",
    imageSrc: "/assets/img/cards/rulo-clear.jpg",
    comingSoon: !ETIKET_RULO_ENABLED,
  },
];

function PopularCard({
  product,
  isEn,
}: {
  product: PopularProduct;
  isEn: boolean;
}) {
  const title = isEn ? product.titleEn : product.titleTr;
  const desc = isEn ? product.descEn : product.descTr;

  const inner = (
    <>
      <div className="relative aspect-[3/2] rounded-xl overflow-hidden bg-gri-50 mb-3">
        {product.comingSoon && (
          <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-lacivert/90 text-white text-[11px] font-semibold uppercase tracking-wide">
            {isEn ? "Coming soon" : "Yakında"}
          </span>
        )}
        <Image
          src={product.imageSrc}
          alt={title}
          fill
          loading="lazy"
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
        />
      </div>
      <h3 className="text-base font-semibold text-lacivert group-hover:text-pim-mercan transition-colors">
        {title}
      </h3>
      <p className="mt-1 text-sm text-gri-600 line-clamp-1">{desc}</p>
    </>
  );

  if (product.comingSoon) {
    return (
      <div
        aria-disabled="true"
        className="block bg-white rounded-2xl border border-gri-200 p-4 opacity-75 pointer-events-none select-none"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={product.href}
      prefetch={false}
      className="group block bg-white rounded-2xl border border-gri-200 hover:border-pim-mercan hover:shadow-lg transition-all duration-150 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-pim-mercan focus-visible:ring-offset-2"
    >
      {inner}
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-px flex-1 bg-gri-200" />
      <h3 className="text-sm font-bold text-lacivert uppercase tracking-[0.08em]">
        {children}
      </h3>
      <div className="h-px flex-1 bg-gri-200" />
    </div>
  );
}

export function HomePopularProducts({ locale }: HomePopularProductsProps) {
  const isEn = locale === "en";

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight text-lacivert">
            {isEn ? "Popular products" : "Popüler ürünler"}
          </h2>
          <p className="mt-2 text-[14px] md:text-base text-gri-700 max-w-[560px] mx-auto leading-relaxed">
            {isEn
              ? "Most-loved sticker and label types"
              : "En çok tercih edilen sticker ve etiket tipleri"}
          </p>
        </div>

        <GroupLabel>{isEn ? "Popular stickers" : "Popüler Sticker'lar"}</GroupLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-12">
          {STICKER_POPULAR.map((product) => (
            <PopularCard key={product.href} product={product} isEn={isEn} />
          ))}
        </div>

        <GroupLabel>{isEn ? "Popular labels" : "Popüler Etiketler"}</GroupLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {ETIKET_POPULAR.map((product) => (
            <PopularCard key={product.href} product={product} isEn={isEn} />
          ))}
        </div>
      </div>
    </section>
  );
}
