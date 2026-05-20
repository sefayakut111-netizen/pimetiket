/**
 * Sticker Card SVG Registry (Sefa 21 May v68 Mig 074)
 *
 * /sticker grid kartlarındaki 11 inline JSX SVG component, hem /sticker
 * (müşteri) hem /admin/urunler (admin preview) için ortak. DB tarafında
 * product_cards.svg_id ile bu registry key'leri eşleşir.
 *
 * Migration 074 seed:
 *   diecut, circle, rectangle, square, oval, bumper, kisscut, clear,
 *   holo, glitter, sheet
 */

import type { FC } from "react";

const STROKE = "#1F1B2D";

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

export function DieCutIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="diecut" />
      <g filter="url(#sticker-shadow-diecut)">
        <path d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z" fill="url(#sticker-primary-diecut)" stroke={STROKE} strokeWidth="2.5" />
        <path d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 3" opacity="0.5" />
      </g>
    </svg>
  );
}

export function CircleIcon() {
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

export function RectangleIcon() {
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

export function SquareIcon() {
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

export function OvalIcon() {
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

export function BumperIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="bumper" />
      <g filter="url(#sticker-shadow-bumper)">
        <rect x="20" y="80" width="160" height="34" rx="14" fill="url(#sticker-secondary-bumper)" stroke={STROKE} strokeWidth="2" opacity="0.7" transform="rotate(3 100 97)" />
        <rect x="20" y="30" width="160" height="36" rx="15" fill="url(#sticker-primary-bumper)" stroke={STROKE} strokeWidth="2.5" transform="rotate(-2 100 48)" />
        <rect x="40" y="40" width="60" height="14" rx="3" fill="#FFFFFF" opacity="0.35" transform="rotate(-2 70 47)" />
      </g>
    </svg>
  );
}

export function KissCutIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="kc" />
      <g filter="url(#sticker-shadow-kc)">
        <rect x="40" y="20" width="120" height="90" rx="3" fill="#FFFFFF" stroke={STROKE} strokeWidth="2" />
        <path d="M 80 50 q 8 -12 20 -8 q 12 -8 18 4 q 14 -2 16 14 q 12 4 -2 16 q 4 14 -12 12 q -8 12 -22 -2 q -18 4 -16 -10 q -14 -6 -4 -16 q -4 -10 2 -10 z" fill="url(#sticker-primary-kc)" stroke={STROKE} strokeWidth="2" />
        <path d="M 80 50 q 8 -12 20 -8 q 12 -8 18 4 q 14 -2 16 14 q 12 4 -2 16 q 4 14 -12 12 q -8 12 -22 -2 q -18 4 -16 -10 q -14 -6 -4 -16 q -4 -10 2 -10 z" fill="none" stroke="#FF6B5B" strokeWidth="1.2" strokeDasharray="3 2" />
      </g>
    </svg>
  );
}

export function ClearIcon() {
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
          <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#sticker-shadow-clear)">
        <path d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z" fill="url(#clear-glass)" stroke={STROKE} strokeWidth="2.5" />
        <path d="M 75 40 q 8 -6 22 -3 q 6 2 4 8 q -4 5 -16 6 q -16 0 -10 -11 z" fill="#FFFFFF" opacity="0.5" />
      </g>
    </svg>
  );
}

export function HoloIcon() {
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
          <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#sticker-shadow-holo)">
        <path d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z" fill="url(#holo-rainbow)" stroke={STROKE} strokeWidth="2.5" opacity="0.85" />
        <path d="M 75 50 q 14 -6 32 -3 q 6 4 -10 12 q -22 0 -22 -9 z" fill="#FFFFFF" opacity="0.55" />
      </g>
    </svg>
  );
}

export function GlitterIcon() {
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
          <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#sticker-shadow-glitter)">
        <path d="M 60 30 q 14 -16 32 -10 q 18 -10 30 4 q 22 -2 24 22 q 18 8 -2 26 q 8 22 -18 22 q -10 18 -32 6 q -28 10 -28 -14 q -22 -12 -6 -28 q -8 -16 0 -28 z" fill="url(#glitter-base)" stroke={STROKE} strokeWidth="2.5" />
        {[[78, 42], [102, 36], [128, 50], [88, 60], [118, 72], [70, 78], [142, 66], [96, 84], [60, 60], [134, 90], [108, 102], [82, 96]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.5 : 1.5} fill="#FFFFFF" opacity="0.85" />
        ))}
      </g>
    </svg>
  );
}

export function SheetIcon() {
  return (
    <svg viewBox="0 0 200 130" className="w-full h-32" aria-hidden="true">
      <GradientDefs id="sheet" />
      <defs>
        <filter id="sticker-shadow-sheet" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="3" />
          <feComponentTransfer><feFuncA type="linear" slope="0.2" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g opacity="0.5" transform="rotate(-3 100 65)">
        <rect x="46" y="20" width="108" height="86" rx="3" fill="#F4F1E6" stroke={STROKE} strokeWidth="1.4" />
      </g>
      <g filter="url(#sticker-shadow-sheet)" transform="rotate(-6 100 65)">
        <rect x="40" y="14" width="112" height="92" rx="3" fill="#FFFFFF" stroke={STROKE} strokeWidth="2" />
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

/** SVG id → component map. DB seed (Mig 074) bu key'leri svg_id alanında tutar. */
export const STICKER_SVG_REGISTRY: Record<string, FC> = {
  diecut: DieCutIcon,
  circle: CircleIcon,
  rectangle: RectangleIcon,
  square: SquareIcon,
  oval: OvalIcon,
  bumper: BumperIcon,
  kisscut: KissCutIcon,
  clear: ClearIcon,
  holo: HoloIcon,
  glitter: GlitterIcon,
  sheet: SheetIcon,
};

/** SVG id'den component al, bulamazsa DieCutIcon (default fallback). */
export function getStickerCardSvg(svgId: string | null | undefined): FC {
  if (!svgId) return DieCutIcon;
  return STICKER_SVG_REGISTRY[svgId] ?? DieCutIcon;
}
