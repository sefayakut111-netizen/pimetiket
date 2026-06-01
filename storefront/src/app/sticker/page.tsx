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
 *   7. Clear            → cut=diecut, material=transparan
 *   8. Holographic      → cut=diecut, material=holo
 *   9. Glitter         → cut=diecut, material=simli
 *  10. Yarı Kesim (die-cut fiyat) → cut=diecut, shape=diecut (die cut sütununun sonu)
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
import { guardCards } from "@/lib/product-cards-guard";
import Link from "next/link";
import Image from "next/image";
import { useT } from "@/lib/i18n/context";
import { track } from "@/lib/analytics/posthog-events";
import { ga4ViewItem } from "@/lib/analytics/ga4-events";
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
  /** Inline SVG fallback (PNG yoksa kullanılır) */
  svg: React.ReactNode;
  /** Sefa 22 May v68 — gerçek illüstrasyon PNG'si. Varsa svg'yi geçer. */
  imageSrc?: string;
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
    imageSrc: "/assets/img/cards/sticker-diecut.jpg",
  },
  {
    query: "cut=diecut&shape=circle",
    titleTr: "Yuvarlak Sticker",
    titleEn: "Circle Sticker",
    descTr: "Daire form — laptop, su şişesi, marka",
    descEn: "Circle form — laptop, water bottle, logo",
    svg: <CircleIcon />,
    imageSrc: "/assets/img/cards/sticker-circle.jpg",
  },
  {
    query: "cut=diecut&shape=rectangle",
    titleTr: "Dikdörtgen Sticker",
    titleEn: "Rectangle Sticker",
    descTr: "Yaygın form — düz veya yumuşak köşe",
    descEn: "Most common form — sharp or rounded corner",
    svg: <RectangleIcon />,
    imageSrc: "/assets/img/cards/sticker-rectangle.jpg",
  },
  {
    query: "cut=diecut&shape=square",
    titleTr: "Kare Sticker",
    titleEn: "Square Sticker",
    descTr: "Eş kenar — düz veya yumuşak köşe",
    descEn: "Equal sides — sharp or rounded corner",
    svg: <SquareIcon />,
    imageSrc: "/assets/img/cards/sticker-square.jpg",
  },
  {
    query: "cut=diecut&shape=oval",
    titleTr: "Oval Sticker",
    titleEn: "Oval Sticker",
    descTr: "Elips — vintage, organik form",
    descEn: "Ellipse — vintage, organic",
    svg: <OvalIcon />,
    imageSrc: "/assets/img/cards/sticker-oval.jpg",
  },
  {
    query: "cut=diecut&shape=bumper",
    titleTr: "Bumper Sticker",
    titleEn: "Bumper Sticker",
    descTr: "Uzun yatay — hobi, laptop",
    descEn: "Long horizontal — hobby, laptop",
    svg: <BumperIcon />,
    imageSrc: "/assets/img/cards/sticker-bumper.jpg",
  },
  {
    query: "cut=diecut&shape=diecut&material=transparan",
    titleTr: "Şeffaf Sticker",
    titleEn: "Clear Sticker",
    descTr: "Saydam zemin — cam, arka plan görünsün",
    descEn: "Transparent base — glass, background visible",
    svg: <ClearIcon />,
    imageSrc: "/assets/img/cards/sticker-clear.jpg",
  },
  {
    query: "cut=diecut&shape=diecut&material=holo",
    titleTr: "Holografik Sticker",
    titleEn: "Holographic Sticker",
    descTr: "Gökkuşağı yansıma — premium, etkinlik",
    descEn: "Rainbow reflection — premium, events",
    svg: <HoloIcon />,
    imageSrc: "/assets/img/cards/sticker-hologram.jpg",
  },
  {
    query: "cut=diecut&shape=diecut&material=simli",
    titleTr: "Simli Sticker",
    titleEn: "Glitter Sticker",
    descTr: "Parıltılı dokulu — çocuk, hediye",
    descEn: "Sparkly texture — kids, gifts",
    svg: <GlitterIcon />,
    imageSrc: "/assets/img/cards/sticker-glitter-holo.jpg",
  },
  {
    query: "cut=diecut&shape=diecut",
    titleTr: "Yarı Kesim Sticker",
    titleEn: "Kiss-Cut Sticker",
    descTr: "Çevresi sağlam kağıttan tek tek çıkarılır",
    descEn: "Sticker cut, backing intact — peel individually",
    svg: <KissCutIcon />,
    imageSrc: "/assets/img/cards/sticker-kisscut.jpg",
  },
  {
    // Sefa 22 May v68 (revize): "Tabaka Sticker" → "Sticker Sayfası".
    // Önceki "web sayfası izlenimi" gerekçesi geri alındı — Sefa müşteri
    // dilinde "tabaka" yerine "sayfa"yı tercih ediyor (e-ticaret yaygın
    // kullanım: "sticker sayfası satın al"). Mig 082 ile DB de senkron.
    query: "cut=tabaka&shape=square",
    titleTr: "Sticker Sayfası",
    titleEn: "Sticker Sheet",
    descTr: "Aynı tasarımdan çok adet — tek tabakada",
    descEn: "Many copies of one design — on a single sheet",
    svg: <SheetIcon />,
    imageSrc: "/assets/img/cards/sticker-sheet.jpg",
  },
  {
    query: "cut=tabaka&shape=circle&kilit=tabaka",
    titleTr: "Yuvarlak Etiket Sayfası",
    titleEn: "Circle Label Sheet",
    descTr: "Tek tabakada çok adet yuvarlak — sticker fiyatına",
    descEn: "Many circles on one sheet",
    svg: <CircleIcon />,
    imageSrc: "/assets/img/cards/sticker-tabaka-circle.jpg",
  },
  {
    query: "cut=tabaka&shape=square&kilit=tabaka",
    titleTr: "Kare Etiket Sayfası",
    titleEn: "Square Label Sheet",
    descTr: "Tek tabakada çok adet kare — sticker fiyatına",
    descEn: "Many squares on one sheet",
    svg: <SquareIcon />,
    imageSrc: "/assets/img/cards/sticker-tabaka-square.jpg",
  },
  {
    query: "cut=tabaka&shape=rectangle&kilit=tabaka",
    titleTr: "Dikdörtgen Etiket Sayfası",
    titleEn: "Rectangle Label Sheet",
    descTr: "Tek tabakada çok adet dikdörtgen — sticker fiyatına",
    descEn: "Many rectangles on one sheet",
    svg: <RectangleIcon />,
    imageSrc: "/assets/img/cards/sticker-tabaka-rectangle.jpg",
  },
  {
    query: "cut=tabaka&shape=ozel&material=holo&kilit=tabaka",
    titleTr: "Hologram Sticker Sayfası",
    titleEn: "Holographic Sticker Sheet",
    descTr: "Gökkuşağı yansımalı tabaka — premium",
    descEn: "Rainbow-reflective sheet — premium",
    svg: <HoloIcon />,
    imageSrc: "/assets/img/cards/sticker-tabaka-holo.jpg",
  },
  {
    query: "cut=tabaka&shape=ozel&material=simli&kilit=tabaka",
    titleTr: "Simli Sticker Sayfası",
    titleEn: "Glitter Sticker Sheet",
    descTr: "Parıltılı dokulu tabaka — hediye, çocuk",
    descEn: "Sparkly-texture sheet — gifts, kids",
    svg: <GlitterIcon />,
    imageSrc: "/assets/img/cards/sticker-tabaka-simli.jpg",
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
      prefetch={false}
      className="group block bg-white rounded-2xl border border-gri-200 hover:border-pim-mercan hover:shadow-lg transition-all duration-150 p-4 focus:outline-none focus:ring-2 focus:ring-pim-mercan focus:ring-offset-2"
    >
      {/* Sefa 20 May v68: aspect reservation → CLS=0.
          Sefa 22 May v68: 200/130 (1.54) → 3/2 (1.5) — Sefa'nın illüstrasyon
          JPG'leri ~3:2 oran. imageSrc varsa Next/Image object-cover (kart tam
          dolar), yoksa eski inline SVG fallback (object-contain p-2). */}
      <div className="relative bg-gri-50 group-hover:bg-pim-mercan-tint/30 rounded-xl mb-3 transition-colors flex items-center justify-center aspect-[3/2] overflow-hidden">
        {card.imageSrc ? (
          <Image
            src={card.imageSrc}
            alt={isEn ? card.titleEn : card.titleTr}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          card.svg
        )}
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

function dbCardToStickerCard(db: DbProductCard): StickerCard | null {
  // Sefa 22 May v68: image_src DB column'u var ama buraya map edilmemişti
  // → kart hep svg fallback'e düşüyordu (coral blob). Mig 080 ile DB'de
  // image_src jpg path'leri var; artık öncelikli olarak imageSrc kullan,
  // svg sadece DB null dönerse fallback olarak.
  const SvgComponent = getStickerCardSvg(db.svg_id);
  const queryStr = buildCardQueryString(db.query_params);
  return {
    query: queryStr.startsWith("?") ? queryStr.slice(1) : queryStr,
    titleTr: db.title_tr,
    titleEn: db.title_en,
    descTr: db.desc_tr,
    descEn: db.desc_en,
    svg: <SvgComponent />,
    imageSrc: db.image_src ?? undefined,
  };
}

function cutOf(card: StickerCard): string {
  const q = card.query.startsWith("?") ? card.query.slice(1) : card.query;
  return new URLSearchParams(q).get("cut") ?? "diecut";
}

export default function StickerGridPage() {
  const { locale } = useT();
  const isEn = locale === "en";

  // Sefa 21 May v68 Mig 074: DB'den admin yönetimli kartlar.
  // İlk render fallback STICKER_CARDS, hidrate olunca DB değerleri.
  const [cards, setCards] = useState<StickerCard[]>(STICKER_CARDS);

  useEffect(() => {
    track("product_viewed", { product: "sticker" });
    ga4ViewItem("sticker");
  }, []);

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
        const safe = guardCards(mapped, STICKER_CARDS);
        if (safe.length > 0) setCards(safe);
      })
      .catch(() => {
        /* DB fail → fallback hardcoded kalır */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const diecutCards = cards.filter((c) => cutOf(c) === "diecut");
  const kissCutCards = cards.filter((c) => {
    const cut = cutOf(c);
    return cut === "kisscut" || cut === "tabaka";
  });

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

        {/* Sefa 1 Haz 2026: 2 sütun — sol Die Cut, sağ Kiss Cut / tabaka (etiket deseni) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 lg:divide-x lg:divide-gri-200 mb-12">
          <section className="lg:pr-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-gri-200" />
              <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
                {isEn ? "Die cut" : "Die cut"}
              </h2>
              <div className="h-px flex-1 bg-gri-200" />
            </div>
            <p className="text-center text-[13px] text-gri-700 mb-5 leading-relaxed max-w-md mx-auto">
              {isEn
                ? "Cut to your design's edge — pieces peel off individually. Ideal for logos, brand marks, and custom silhouettes."
                : "Tasarımın kenarından tam kesim, parçalar ayrı. Logo, marka ve özel silüetler için."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {diecutCards.map((card) => (
                <StickerProductCard key={card.query} card={card} isEn={isEn} />
              ))}
            </div>
          </section>

          <section className="lg:pl-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-gri-200" />
              <h2 className="text-lg font-bold text-lacivert uppercase tracking-[0.08em]">
                {isEn ? "Kiss cut" : "Kiss cut"}
              </h2>
              <div className="h-px flex-1 bg-gri-200" />
            </div>
            <p className="text-center text-[13px] text-gri-700 mb-5 leading-relaxed max-w-md mx-auto">
              {isEn
                ? "Kiss-cut on intact backing — sheet or page format. Peel stickers without separating the liner."
                : "Yarım kesim, arka kağıt sağlam; tabaka/sayfa halinde. Liner ayrılmadan sticker çıkar."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {kissCutCards.map((card) => (
                <StickerProductCard key={card.query} card={card} isEn={isEn} />
              ))}
            </div>
          </section>
        </div>

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
