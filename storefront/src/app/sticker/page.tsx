/**
 * /sticker — Görsel ürün filtresi (StickerMule pattern, sticker versiyonu).
 *
 * Sefa 20 May v68 (Sticker reform Aşama S-A):
 * 2 section: üst Tekil sticker (10 kart), alt Sticker tabaka (1 kart).
 * Tıkla → /sticker/yapilandir?cut=...&shape=...&material=...
 *
 * 11 kart eşlemesi:
 *   1. Die cut          → cut=diecut, shape=ozel
 *   2. Circle           → cut=diecut, shape=circle
 *   3. Rectangle        → cut=diecut, shape=rectangle
 *   4. Square           → cut=diecut, shape=square
 *   5. Oval             → cut=diecut, shape=oval
 *   6. Bumper           → cut=diecut, shape=rectangle, preset 280×80, corner=rounded
 *   7. Kiss cut         → cut=kisscut, shape=ozel
 *   8. Clear            → cut=diecut, material=transparan
 *   9. Holographic      → cut=diecut, material=holo
 *   10. Glitter         → cut=diecut, material=simli
 *   11. Sticker sheets  → cut=tabaka
 *
 * Müşteri /sticker'a gelince eskiden direkt konfigüratör vardı.
 * Artık önce görsel grid: 11 kart → tıkla → /sticker/yapilandir.
 *
 * Sefa kararı: Görseller şimdilik inline basit SVG silüet. İleride
 * Midjourney PNG üretilince imageSrc field'a geçilir (etiket pattern).
 * docs/MIDJOURNEY-STICKER-CARDS.md rehber dosyası.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import {
  getStickerCardSvg,
  DieCutIcon as RegistryDieCutIcon,
  CircleIcon as RegistryCircleIcon,
  RectangleIcon as RegistryRectangleIcon,
  SquareIcon as RegistrySquareIcon,
  OvalIcon as RegistryOvalIcon,
  BumperIcon as RegistryBumperIcon,
  KissCutIcon as RegistryKissCutIcon,
  ClearIcon as RegistryClearIcon,
  HoloIcon as RegistryHoloIcon,
  GlitterIcon as RegistryGlitterIcon,
  SheetIcon as RegistrySheetIcon,
} from "@/lib/sticker-card-svg-registry";
import type { ProductCard as DbProductCard } from "@/lib/product-cards";
import { buildCardQueryString } from "@/lib/product-cards";

// Sefa 21 May v68 Mig 074: Registry'den gelen ikonlar — eski inline tanımlar
// hala bu dosyada (uzun edit'i azaltmak için), ama registry source-of-truth.
// Voiding to avoid unused-import warnings if local fns are removed later.
void RegistryDieCutIcon; void RegistryCircleIcon; void RegistryRectangleIcon;
void RegistrySquareIcon; void RegistryOvalIcon; void RegistryBumperIcon;
void RegistryKissCutIcon; void RegistryClearIcon; void RegistryHoloIcon;
void RegistryGlitterIcon; void RegistrySheetIcon;

interface StickerCard {
  /** URL query param'ları */
  query: string;
  /** TR başlık */
  titleTr: string;
  /** EN başlık */
  titleEn: string;
  /** Açıklama TR */
  descTr: string;
  /** Açıklama EN */
  descEn: string;
  /** Inline SVG component (geçici — Midjourney PNG sonra geçer) */
  svg: React.ReactNode;
}

// ============================================================
// Inline SVG silüet helper'ları — etiket Aşama A pattern'i
// (Midjourney görseli hazır olunca imageSrc field'a refactor)
// ============================================================

const STROKE = "#1F1B2D";
const FILL_PRIMARY = "url(#sticker-primary)";
const FILL_SECONDARY = "url(#sticker-secondary)";

/** Ortak gradient defs — tüm SVG'lerde aynı */
function GradientDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`sticker-primary-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FF8585" />
        <stop offset="100%" stopColor="#FF6B5B" />
      </linearGradient>
      <linearGradient id={`sticker-secondary-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFB5A8" />
        <stop offset="100%" stopColor="#FF9988" />
      </linearGradient>
      <filter id={`sticker-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
        <feOffset dx="0" dy="2" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.18" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** Die-cut sticker silüeti — organik blob (Pim mascot benzeri) */
function DieCutIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="diecut" />
      <g filter="url(#sticker-shadow-diecut)">
        <path
          d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z"
          fill="url(#sticker-primary-diecut)"
          stroke={STROKE}
          strokeWidth="2.5"
        />
        <path
          d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeDasharray="4 3"
          opacity="0.5"
        />
      </g>
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="circle" />
      <g filter="url(#sticker-shadow-circle)">
        <circle cx="120" cy="80" r="40" fill="url(#sticker-secondary-circle)" stroke={STROKE} strokeWidth="2" opacity="0.7" />
        <circle cx="95" cy="60" r="46" fill="url(#sticker-primary-circle)" stroke={STROKE} strokeWidth="2.5" />
        <ellipse cx="82" cy="46" rx="14" ry="8" fill="#FFFFFF" opacity="0.4" />
      </g>
    </svg>
  );
}

function RectangleIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="rect" />
      <g filter="url(#sticker-shadow-rect)">
        <rect x="60" y="60" width="90" height="50" rx="3" fill="url(#sticker-secondary-rect)" stroke={STROKE} strokeWidth="2" opacity="0.7" transform="rotate(5 105 85)" />
        <rect x="40" y="20" width="100" height="56" rx="3" fill="url(#sticker-primary-rect)" stroke={STROKE} strokeWidth="2.5" transform="rotate(-4 90 48)" />
        <rect x="48" y="28" width="30" height="10" rx="2" fill="#FFFFFF" opacity="0.4" transform="rotate(-4 63 33)" />
      </g>
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="sq" />
      <g filter="url(#sticker-shadow-sq)">
        <rect x="70" y="60" width="64" height="64" rx="3" fill="url(#sticker-secondary-sq)" stroke={STROKE} strokeWidth="2" opacity="0.7" transform="rotate(6 102 92)" />
        <rect x="55" y="20" width="72" height="72" rx="3" fill="url(#sticker-primary-sq)" stroke={STROKE} strokeWidth="2.5" transform="rotate(-4 91 56)" />
        <rect x="63" y="28" width="18" height="18" rx="2" fill="#FFFFFF" opacity="0.4" transform="rotate(-4 72 37)" />
      </g>
    </svg>
  );
}

function OvalIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="oval" />
      <g filter="url(#sticker-shadow-oval)">
        <ellipse cx="120" cy="88" rx="46" ry="24" fill="url(#sticker-secondary-oval)" stroke={STROKE} strokeWidth="2" opacity="0.7" />
        <ellipse cx="95" cy="55" rx="56" ry="30" fill="url(#sticker-primary-oval)" stroke={STROKE} strokeWidth="2.5" />
        <ellipse cx="80" cy="42" rx="18" ry="7" fill="#FFFFFF" opacity="0.4" />
      </g>
    </svg>
  );
}

function BumperIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="bumper" />
      <g filter="url(#sticker-shadow-bumper)">
        <rect x="20" y="80" width="160" height="34" rx="14" fill="url(#sticker-secondary-bumper)" stroke={STROKE} strokeWidth="2" opacity="0.7" transform="rotate(3 100 97)" />
        <rect x="20" y="30" width="160" height="36" rx="15" fill="url(#sticker-primary-bumper)" stroke={STROKE} strokeWidth="2.5" transform="rotate(-2 100 48)" />
        {/* Sticker üzerine "Bumper" yazısı yerine geometric icon */}
        <rect x="40" y="40" width="60" height="14" rx="3" fill="#FFFFFF" opacity="0.35" transform="rotate(-2 70 47)" />
      </g>
    </svg>
  );
}

function KissCutIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="kc" />
      <g filter="url(#sticker-shadow-kc)">
        {/* Arka kağıt (release liner) */}
        <rect x="40" y="20" width="120" height="90" rx="3" fill="#FFFFFF" stroke={STROKE} strokeWidth="2" />
        {/* Sticker (kesilmiş, kağıt sağlam) */}
        <path
          d="M 80 50 q 8 -12 20 -8 q 12 -8 18 4 q 14 -2 16 14 q 12 4 -2 16 q 4 14 -12 12 q -8 12 -22 -2 q -18 4 -16 -10 q -14 -6 -4 -16 q -4 -10 2 -10 z"
          fill="url(#sticker-primary-kc)"
          stroke={STROKE}
          strokeWidth="2"
        />
        {/* Kesim hattı (dashed) */}
        <path
          d="M 80 50 q 8 -12 20 -8 q 12 -8 18 4 q 14 -2 16 14 q 12 4 -2 16 q 4 14 -12 12 q -8 12 -22 -2 q -18 4 -16 -10 q -14 -6 -4 -16 q -4 -10 2 -10 z"
          fill="none"
          stroke="#FF6B5B"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
      </g>
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <defs>
        <linearGradient id="clear-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DDEEFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#A8CFEC" stopOpacity="0.3" />
        </linearGradient>
        <filter id="sticker-shadow-clear" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.18" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#sticker-shadow-clear)">
        <path
          d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z"
          fill="url(#clear-glass)"
          stroke={STROKE}
          strokeWidth="2.5"
        />
        {/* Cam parlama */}
        <path d="M 75 40 q 8 -6 22 -3 q 6 2 4 8 q -4 5 -16 6 q -16 0 -10 -11 z" fill="#FFFFFF" opacity="0.5" />
      </g>
    </svg>
  );
}

function HoloIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <defs>
        <linearGradient id="holo-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B9D" />
          <stop offset="25%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#60E0F0" />
          <stop offset="75%" stopColor="#7CE5A3" />
          <stop offset="100%" stopColor="#FFD56B" />
        </linearGradient>
        <filter id="sticker-shadow-holo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.18" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#sticker-shadow-holo)">
        <path
          d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z"
          fill="url(#holo-rainbow)"
          stroke={STROKE}
          strokeWidth="2.5"
          opacity="0.85"
        />
        <path d="M 75 50 q 14 -6 32 -3 q 6 4 -10 12 q -22 0 -22 -9 z" fill="#FFFFFF" opacity="0.55" />
      </g>
    </svg>
  );
}

function GlitterIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <defs>
        <linearGradient id="glitter-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB5A8" />
          <stop offset="100%" stopColor="#FF6B5B" />
        </linearGradient>
        <filter id="sticker-shadow-glitter" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.18" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#sticker-shadow-glitter)">
        <path
          d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z"
          fill="url(#glitter-base)"
          stroke={STROKE}
          strokeWidth="2.5"
        />
        {/* Glitter parıltıları — random dots */}
        {[
          [78, 42], [102, 36], [128, 50], [88, 60], [118, 72], [70, 78],
          [142, 66], [96, 84], [60, 60], [134, 90], [108, 102], [82, 96],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.5 : 1.5} fill="#FFFFFF" opacity="0.85" />
        ))}
      </g>
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="sheet" />
      <defs>
        <filter id="sticker-shadow-sheet" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="3" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g opacity="0.5" transform="rotate(-3 100 65)">
        <rect x="46" y="20" width="108" height="86" rx="3" fill="#F4F1E6" stroke={STROKE} strokeWidth="1.4" />
      </g>
      <g filter="url(#sticker-shadow-sheet)" transform="rotate(-6 100 65)">
        <rect x="40" y="14" width="112" height="92" rx="3" fill="#FFFFFF" stroke={STROKE} strokeWidth="2" />
        {/* Karışık şekiller — sticker tabaka mix */}
        <g fill="url(#sticker-primary-sheet)" stroke={STROKE} strokeWidth="1.2">
          <circle cx="62" cy="34" r="9" />
          <rect x="84" y="26" width="16" height="16" rx="2" />
          <ellipse cx="124" cy="34" rx="12" ry="7" />
          <path d="M 56 60 q 6 -8 14 -4 q 8 -2 6 8 q 6 4 -4 10 q -10 4 -12 -4 q -10 -4 -4 -10 z" />
          <rect x="86" y="56" width="20" height="14" rx="2" />
          <circle cx="124" cy="62" r="8" />
          <ellipse cx="62" cy="88" rx="14" ry="7" />
          <path d="M 86 84 q 6 -8 14 -4 q 8 -2 6 8 q 6 4 -4 10 q -10 4 -12 -4 q -10 -4 -4 -10 z" />
          <circle cx="124" cy="88" r="8" />
        </g>
      </g>
    </svg>
  );
}

// ============================================================
// 11 kart verisi
// ============================================================

// Sefa 20 May v68: tek grid (eski 2 section birleşti).
// Tüm sticker tipleri tek liste — sticker sayfası dahil.
// Kart adlarında "sticker" suffix'i (Sefa kararı).
const STICKER_CARDS: StickerCard[] = [
  {
    query: "cut=diecut&shape=diecut",
    titleTr: "Özel Kesim Sticker",
    titleEn: "Die-Cut Sticker",
    descTr: "Logo veya tasarımın silüetine kesim",
    descEn: "Cut to your design's silhouette",
    svg: <DieCutIcon />,
  },
  {
    query: "cut=diecut&shape=circle",
    titleTr: "Yuvarlak Sticker",
    titleEn: "Circle Sticker",
    descTr: "Daire form — laptop, su şişesi, marka",
    descEn: "Circle form — laptop, water bottle, logo",
    svg: <CircleIcon />,
  },
  {
    query: "cut=diecut&shape=rectangle",
    titleTr: "Dikdörtgen Sticker",
    titleEn: "Rectangle Sticker",
    descTr: "Yaygın form — düz veya yumuşak köşe",
    descEn: "Most common form — sharp or rounded corner",
    svg: <RectangleIcon />,
  },
  {
    query: "cut=diecut&shape=square",
    titleTr: "Kare Sticker",
    titleEn: "Square Sticker",
    descTr: "Eş kenar — düz veya yumuşak köşe",
    descEn: "Equal sides — sharp or rounded corner",
    svg: <SquareIcon />,
  },
  {
    query: "cut=diecut&shape=oval",
    titleTr: "Oval Sticker",
    titleEn: "Oval Sticker",
    descTr: "Elips — vintage, organik form",
    descEn: "Ellipse — vintage, organic",
    svg: <OvalIcon />,
  },
  {
    query: "cut=diecut&shape=bumper",
    titleTr: "Bumper Sticker",
    titleEn: "Bumper Sticker",
    descTr: "Uzun yatay — hobi, laptop",
    descEn: "Long horizontal — hobby, laptop",
    svg: <BumperIcon />,
  },
  {
    query: "cut=kisscut&shape=diecut",
    titleTr: "Yarı Kesim Sticker",
    titleEn: "Kiss-Cut Sticker",
    descTr: "Çevresi sağlam kağıttan tek tek çıkarılır",
    descEn: "Sticker cut, backing intact — peel individually",
    svg: <KissCutIcon />,
  },
  {
    query: "cut=diecut&shape=diecut&material=transparan",
    titleTr: "Şeffaf Sticker",
    titleEn: "Clear Sticker",
    descTr: "Saydam zemin — cam, arka plan görünsün",
    descEn: "Transparent base — glass, background visible",
    svg: <ClearIcon />,
  },
  {
    query: "cut=diecut&shape=diecut&material=holo",
    titleTr: "Holografik Sticker",
    titleEn: "Holographic Sticker",
    descTr: "Gökkuşağı yansıma — premium, etkinlik",
    descEn: "Rainbow reflection — premium, events",
    svg: <HoloIcon />,
  },
  {
    query: "cut=diecut&shape=diecut&material=simli",
    titleTr: "Simli Sticker",
    titleEn: "Glitter Sticker",
    descTr: "Parıltılı dokulu — çocuk, hediye",
    descEn: "Sparkly texture — kids, gifts",
    svg: <GlitterIcon />,
  },
  {
    query: "cut=tabaka&shape=square",
    titleTr: "Sticker Sayfası",
    titleEn: "Sticker Sheet",
    descTr: "Karma şekiller, tek sayfada",
    descEn: "Mixed shapes on a single sheet",
    svg: <SheetIcon />,
  },
];

// ============================================================
// Tek kart component
// ============================================================

function StickerProductCard({
  card,
  isEn,
}: {
  card: StickerCard;
  isEn: boolean;
}) {
  return (
    <Link
      href={`/sticker/yapilandir?${card.query}`}
      className="group block bg-white rounded-2xl border border-gri-200 hover:border-pim-mercan hover:shadow-lg transition-all duration-150 p-4 focus:outline-none focus:ring-2 focus:ring-pim-mercan focus:ring-offset-2"
    >
      {/* Sefa 20 May v68: aspect-[200/130] reservation → CLS=0.
          İnline SVG'ler stretch eder, Midjourney PNG geldiğinde aynı
          aspect kalır, layout shift yok. */}
      <div className="bg-gri-50 group-hover:bg-pim-mercan-tint/30 rounded-xl mb-3 transition-colors flex items-center justify-center aspect-[200/130] overflow-hidden">
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

// ============================================================
// Sayfa component
// ============================================================

// Sefa 21 May v68 Mig 074: DB card → STICKER_CARDS UI format
function dbCardToStickerCard(db: DbProductCard): StickerCard | null {
  const SvgComponent = getStickerCardSvg(db.svg_id);
  const queryStr = buildCardQueryString(db.query_params);
  return {
    // Eski format: query string (ön ek "?" olmadan)
    query: queryStr.startsWith("?") ? queryStr.slice(1) : queryStr,
    titleTr: db.title_tr,
    titleEn: db.title_en,
    descTr: db.desc_tr,
    descEn: db.desc_en,
    svg: <SvgComponent />,
  };
}

export default function StickerGridPage() {
  const { locale } = useT();
  const isEn = locale === "en";

  // Sefa 21 May v68 Mig 074: DB'den admin yönetimli kartlar.
  // İlk render fallback STICKER_CARDS, hidrate olunca DB değerleri.
  const [cards, setCards] = useState<StickerCard[]>(STICKER_CARDS);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/product-cards?product_type=sticker", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || !Array.isArray(j.cards) || j.cards.length === 0) {
          return;
        }
        const mapped = (j.cards as DbProductCard[])
          .map(dbCardToStickerCard)
          .filter((c): c is StickerCard => c !== null);
        if (mapped.length > 0) setCards(mapped);
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
        {/* Header — Sefa 20 May v68: yaratıcı alt açıklama + min adet bilgisi */}
        <header className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-lacivert">
            {isEn ? "Choose your sticker type" : "Sticker tipini seç"}
          </h1>
          <p className="mt-3 text-[15px] text-gri-700 max-w-2xl mx-auto leading-relaxed">
            {isEn
              ? "Pick the form that reflects you — starts at 25 pcs. Prototypes, gifts, events, collections, hobby: useful across many spaces. Material, size, and quantity in the next step — customization is all yours."
              : "Seni yansıtacak formu seç — 25 adetten başlayabilirsin. Prototip, hediye, etkinlik, koleksiyon ve hobi: birçok alanda yanında. Malzeme, boyut ve adet sonraki adımda — özelleştirme tamamen sende."}
          </p>
        </header>

        {/* Sefa 20 May v68: başlık ile ürünler arasında ince ayırıcı çizgi */}
        <div className="h-px bg-gri-200 max-w-5xl mx-auto mb-8" />

        {/* Sefa 20 May v68: tek grid (eski 2 section birleşti — section
            başlıkları kaldırıldı). 11 sticker kartı tek listede sıralanır. */}
        <section className="mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {cards.map((card) => (
              <StickerProductCard key={card.query} card={card} isEn={isEn} />
            ))}
          </div>
        </section>

        {/* Alt CTA — etiket yönlendirme */}
        <div className="mt-12 text-center">
          <p className="text-gri-700 text-sm">
            {isEn ? "Looking for labels instead?" : "Etiket mi arıyorsun?"}{" "}
            <Link
              href="/etiket"
              className="text-pim-mercan font-semibold underline underline-offset-2 hover:decoration-2"
            >
              {isEn ? "Browse labels" : "Etiket sayfasına git"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
