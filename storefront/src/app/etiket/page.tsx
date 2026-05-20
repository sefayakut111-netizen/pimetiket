/**
 * /etiket — Görsel ürün filtresi (StickerMule pattern).
 *
 * Sefa 20 May v68 (Konfigüratör reform Aşama A + grid v2):
 * 2 section: üst Rulo etiket (7 şekil), alt Tabaka etiket (6 şekil).
 * Tıkla → /etiket/yapilandir?form=...&shape=...
 *
 * Tasarım kararları:
 *   - Hover'da pim-mercan border + shadow (Sefa pattern)
 *   - SVG silüet inline — kahverengi yerine palet (mercan/lacivert)
 *   - Rulo: silindir + üst kısımda şekil silüetleri
 *   - Tabaka: A4 kağıt + üzerinde şekil grid (3×4 daire, 2×3 die-cut vb.)
 *   - 4-col md, 2-col sm, 1-col mobile
 *   - "Aradığını bulamadın mı?" CTA altta — sticker'a yönlendirir
 *
 * Şekil/form eşlemesi şu an URL param olarak iletilir; /etiket/yapilandir
 * page useSearchParams ile pre-fill yapar.
 */

"use client";

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
  /** Inline SVG component */
  svg: React.ReactNode;
}

// ============================================================
// RULO silüet — silindir + üst kısımda şekilli sticker'lar
// ============================================================

type RollShape =
  | "diecut"
  | "clear"
  | "circle"
  | "square"
  | "rectangle"
  | "rounded"
  | "oval";

function RollIllustration({ stickerShape }: { stickerShape: RollShape }) {
  return (
    <svg
      viewBox="0 0 180 130"
      className="w-full h-32"
      aria-hidden="true"
    >
      {/* Rulo silindir */}
      <ellipse cx="50" cy="80" rx="45" ry="42" fill="#FFFFFF" stroke="#1A1F36" strokeWidth="2" />
      <ellipse cx="50" cy="80" rx="12" ry="11" fill="#F4F4F6" stroke="#1A1F36" strokeWidth="1.5" />
      <path d="M 50 38 Q 95 38 95 80 Q 95 122 50 122" fill="none" stroke="#1A1F36" strokeWidth="2" />
      {/* Sağ tarafta etiketler (stacked silhouettes) */}
      {stickerShape === "diecut" && (
        <g fill="#FF8585" stroke="#1A1F36" strokeWidth="1.5">
          <path d="M 110 58 q 8 -10 18 -6 q 8 -6 14 4 q 12 0 8 14 q 8 4 -2 14 q 4 14 -10 12 q -8 8 -16 -2 q -16 4 -14 -10 q -10 -8 -2 -16 q -4 -10 4 -10 z" />
          <path d="M 130 88 q 8 -10 18 -6 q 8 -6 14 4 q 12 0 8 14 q -2 12 -14 8 q -16 4 -14 -10 q -10 -8 -2 -16 q -4 -10 4 -10 z" opacity="0.6" />
        </g>
      )}
      {stickerShape === "clear" && (
        <g stroke="#1A1F36" strokeWidth="1.5" fill="rgba(133, 197, 255, 0.25)">
          <path d="M 108 62 q 5 -8 16 -5 q 8 -4 12 4 q 10 0 7 10 q 5 6 -2 10 q 3 8 -6 9 q -5 5 -12 -2 q -10 3 -10 -7 q -7 -6 -1 -12 q -3 -7 3 -7 z" />
        </g>
      )}
      {stickerShape === "circle" && (
        <g fill="#FF8585" stroke="#1A1F36" strokeWidth="1.5">
          <circle cx="130" cy="62" r="16" />
          <circle cx="148" cy="92" r="14" opacity="0.6" />
        </g>
      )}
      {stickerShape === "square" && (
        <g fill="#FF8585" stroke="#1A1F36" strokeWidth="1.5">
          <rect x="115" y="48" width="32" height="32" rx="2" />
          <rect x="130" y="82" width="28" height="28" rx="2" opacity="0.6" />
        </g>
      )}
      {stickerShape === "rectangle" && (
        <g fill="#FF8585" stroke="#1A1F36" strokeWidth="1.5">
          <rect x="108" y="52" width="48" height="24" rx="2" />
          <rect x="120" y="84" width="44" height="22" rx="2" opacity="0.6" />
        </g>
      )}
      {stickerShape === "rounded" && (
        <g fill="#FF8585" stroke="#1A1F36" strokeWidth="1.5">
          <rect x="108" y="52" width="48" height="24" rx="10" />
          <rect x="120" y="84" width="44" height="22" rx="10" opacity="0.6" />
        </g>
      )}
      {stickerShape === "oval" && (
        <g fill="#FF8585" stroke="#1A1F36" strokeWidth="1.5">
          <ellipse cx="130" cy="64" rx="22" ry="14" />
          <ellipse cx="148" cy="94" rx="20" ry="13" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}

// ============================================================
// TABAKA silüet — A4 kağıt + üzerinde şekilli grid
// ============================================================

type SheetShape =
  | "diecut"
  | "circle"
  | "square"
  | "rectangle"
  | "rounded"
  | "oval";

function SheetIllustration({ stickerShape }: { stickerShape: SheetShape }) {
  /** Şekil bazlı grid layout */
  const renderShapes = () => {
    const fill = "#FF8585";
    const stroke = "#1A1F36";
    const strokeWidth = 1.2;

    switch (stickerShape) {
      case "circle":
        // 3×4 = 12 daire
        return (
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
            {[0, 1, 2, 3].map((row) =>
              [0, 1, 2].map((col) => (
                <circle
                  key={`${row}-${col}`}
                  cx={52 + col * 28}
                  cy={32 + row * 20}
                  r="8"
                />
              ))
            )}
          </g>
        );

      case "diecut":
        // 2×3 = 6 die-cut silüet (basit blob)
        return (
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
            {[0, 1, 2].map((row) =>
              [0, 1].map((col) => {
                const cx = 62 + col * 40;
                const cy = 35 + row * 25;
                return (
                  <path
                    key={`${row}-${col}`}
                    d={`M ${cx - 10} ${cy - 6} q 4 -8 12 -4 q 6 -4 10 4 q 6 4 -2 10 q 0 8 -10 6 q -10 4 -10 -4 q -8 -2 0 -12 z`}
                  />
                );
              })
            )}
          </g>
        );

      case "oval":
        // 2×4 = 8 oval
        return (
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
            {[0, 1, 2, 3].map((row) =>
              [0, 1].map((col) => (
                <ellipse
                  key={`${row}-${col}`}
                  cx={64 + col * 42}
                  cy={32 + row * 20}
                  rx="14"
                  ry="7"
                />
              ))
            )}
          </g>
        );

      case "rectangle":
        // 2×4 = 8 yatay dikdörtgen
        return (
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
            {[0, 1, 2, 3].map((row) =>
              [0, 1].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={50 + col * 42}
                  y={26 + row * 20}
                  width="32"
                  height="14"
                  rx="2"
                />
              ))
            )}
          </g>
        );

      case "rounded":
        // 2×4 = 8 yumuşak köşeli dikdörtgen
        return (
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
            {[0, 1, 2, 3].map((row) =>
              [0, 1].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={50 + col * 42}
                  y={26 + row * 20}
                  width="32"
                  height="14"
                  rx="7"
                />
              ))
            )}
          </g>
        );

      case "square":
      default:
        // 3×3 = 9 kare
        return (
          <g fill={fill} stroke={stroke} strokeWidth={strokeWidth}>
            {[0, 1, 2].map((row) =>
              [0, 1, 2].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={50 + col * 28}
                  y={30 + row * 26}
                  width="22"
                  height="22"
                  rx="2"
                />
              ))
            )}
          </g>
        );
    }
  };

  return (
    <svg viewBox="0 0 180 130" className="w-full h-32" aria-hidden="true">
      {/* A4 kağıt — biraz eğik (StickerMule pattern) */}
      <g transform="rotate(-6 90 65)">
        <rect
          x="32"
          y="18"
          width="116"
          height="94"
          rx="3"
          fill="#FFFFFF"
          stroke="#1A1F36"
          strokeWidth="2"
        />
        {renderShapes()}
      </g>
    </svg>
  );
}

// ============================================================
// Kart verisi
// ============================================================

const RULO_CARDS: EtiketCard[] = [
  {
    shape: "diecut",
    form: "rulo",
    titleTr: "Özel kesim rulo",
    titleEn: "Die-cut roll",
    descTr: "Her forma kontur kesim",
    descEn: "Custom contour cut",
    svg: <RollIllustration stickerShape="diecut" />,
  },
  {
    shape: "clear",
    form: "rulo",
    titleTr: "Şeffaf rulo",
    titleEn: "Clear roll",
    descTr: "Transparan/şeffaf zemin",
    descEn: "Transparent labels",
    svg: <RollIllustration stickerShape="clear" />,
  },
  {
    shape: "circle",
    form: "rulo",
    titleTr: "Yuvarlak rulo",
    titleEn: "Circle roll",
    descTr: "Standart daire etiket",
    descEn: "Round labels",
    svg: <RollIllustration stickerShape="circle" />,
  },
  {
    shape: "square",
    form: "rulo",
    titleTr: "Kare rulo",
    titleEn: "Square roll",
    descTr: "Eş kenarlı kare",
    descEn: "Square labels",
    svg: <RollIllustration stickerShape="square" />,
  },
  {
    shape: "rectangle",
    form: "rulo",
    titleTr: "Dikdörtgen rulo",
    titleEn: "Rectangle roll",
    descTr: "Klasik dikdörtgen — düz veya yumuşak köşe",
    descEn: "Rectangle — sharp or rounded corner",
    svg: <RollIllustration stickerShape="rectangle" />,
  },
  // Sefa 20 May v68: Köşe-yuvarlak rulo iptal — bunun yerine kare/dikdörtgen
  // konfigüratöründe "Düz / Yumuşak köşe" seçeneği var.
  {
    shape: "oval",
    form: "rulo",
    titleTr: "Oval rulo",
    titleEn: "Oval roll",
    descTr: "Oval/elips etiket",
    descEn: "Oval labels",
    svg: <RollIllustration stickerShape="oval" />,
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
    svg: <SheetIllustration stickerShape="circle" />,
  },
  {
    shape: "diecut",
    form: "tabaka",
    titleTr: "Özel kesim tabaka",
    titleEn: "Die-cut sheet labels",
    descTr: "Tabaka üstü kontur kesim",
    descEn: "Contour cut on sheet",
    svg: <SheetIllustration stickerShape="diecut" />,
  },
  {
    shape: "oval",
    form: "tabaka",
    titleTr: "Oval tabaka",
    titleEn: "Oval sheet labels",
    descTr: "Tabaka üstü oval",
    descEn: "Oval labels on sheet",
    svg: <SheetIllustration stickerShape="oval" />,
  },
  {
    shape: "rectangle",
    form: "tabaka",
    titleTr: "Dikdörtgen tabaka",
    titleEn: "Rectangle sheet labels",
    descTr: "Tabaka üstü dikdörtgen — düz veya yumuşak köşe",
    descEn: "Rectangle on sheet — sharp or rounded",
    svg: <SheetIllustration stickerShape="rectangle" />,
  },
  // Sefa 20 May v68: Köşe-yuvarlak tabaka iptal — kare/dikdörtgen
  // konfigüratöründe köşe seçeneği var.
  {
    shape: "square",
    form: "tabaka",
    titleTr: "Kare tabaka",
    titleEn: "Square sheet labels",
    descTr: "Tabaka üstü kare",
    descEn: "Square labels on sheet",
    svg: <SheetIllustration stickerShape="square" />,
  },
];

// ============================================================
// Sayfa component
// ============================================================

/** Tek kart — Link wrapper, hover state */
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
      <div className="bg-gri-50 group-hover:bg-pim-mercan-tint/30 rounded-xl py-3 mb-3 transition-colors">
        {card.svg}
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

export default function EtiketGridPage() {
  const { locale } = useT();
  const isEn = locale === "en";

  return (
    <main className="min-h-screen bg-gri-50 pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-lacivert mb-3">
            {isEn ? "Choose your label type" : "Etiket tipini seç"}
          </h1>
          <p className="text-gri-700 text-base max-w-2xl mx-auto">
            {isEn
              ? "Pick a shape to start configuring. Material, coating, size, and quantity come next."
              : "Şekli seç, sonraki adımda malzeme/boyut/adet düzenlersin. 1.000 adetten başlar, 5 iş günü kargoda."}
          </p>
        </header>

        {/* ÜST SECTION — Rulo etiket (7 kart) */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-gri-200" />
            <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
              {isEn ? "Roll labels" : "Rulo etiket"}
            </h2>
            <div className="h-px flex-1 bg-gri-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {RULO_CARDS.map((card) => (
              <ProductCard
                key={`${card.form}-${card.shape}`}
                card={card}
                isEn={isEn}
              />
            ))}
          </div>
        </section>

        {/* ALT SECTION — Tabaka etiket (6 kart) */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-gri-200" />
            <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
              {isEn ? "Sheet labels" : "Tabaka etiket"}
            </h2>
            <div className="h-px flex-1 bg-gri-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {TABAKA_CARDS.map((card) => (
              <ProductCard
                key={`${card.form}-${card.shape}`}
                card={card}
                isEn={isEn}
              />
            ))}
          </div>
        </section>

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
