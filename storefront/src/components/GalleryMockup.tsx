/**
 * GalleryMockup — /galeri sayfasında müşteri showcase için.
 *
 * Renk gradient placeholder yerine, ürün siluet'i (şişe / kahve poşeti /
 * laptop / kart / kutu) üzerinde etiket görünümü.
 *
 * Tüm SVG inline — gerçek müşteri fotoğrafı çekildiğinde bu component
 * `<img>` ile değiştirilir. Bu interim çözüm "pure gradient placeholder"
 * yerine "ürün üzerinde etiket" hissini verir.
 */

import * as React from "react";

export type MockupVariant =
  | "bottle" // kozmetik / sabun (Olea)
  | "coffee" // kahve poşeti (Bulutlu Roastery)
  | "laptop" // laptop sticker
  | "olive" // zeytinyağı şişesi (Zeytin & Co.)
  | "tea" // çay paketi (Yeşil Yaprak)
  | "round" // yuvarlak sticker (Atölye Niş, Festival, Pop-up)
  | "tube"; // tüp (Çiğdem Atölye tekstil ya da kozmetik)

interface GalleryMockupProps {
  variant: MockupVariant;
  brandName: string;
  /** Etiket arka plan rengi — malzeme hissi için */
  labelBg?: string;
  /** Etiket metin rengi */
  labelColor?: string;
  /** Sahne arka plan rengi */
  sceneBg?: string;
}

export function GalleryMockup({
  variant,
  brandName,
  labelBg = "#FFF5EB",
  labelColor = "#1F2335",
  sceneBg = "linear-gradient(135deg, #FFF5EB 0%, #FFE3D2 100%)",
}: GalleryMockupProps) {
  return (
    <div
      className="relative grid place-items-center w-full h-full min-h-[200px] overflow-hidden"
      style={{ background: sceneBg }}
      aria-label={`${brandName} — ürün mockup'ı`}
    >
      <Scene
        variant={variant}
        brandName={brandName}
        labelBg={labelBg}
        labelColor={labelColor}
      />
    </div>
  );
}

function Scene({
  variant,
  brandName,
  labelBg,
  labelColor,
}: {
  variant: MockupVariant;
  brandName: string;
  labelBg: string;
  labelColor: string;
}) {
  if (variant === "bottle") {
    return <BottleMockup brand={brandName} labelBg={labelBg} labelColor={labelColor} />;
  }
  if (variant === "coffee") {
    return <CoffeeMockup brand={brandName} labelBg={labelBg} labelColor={labelColor} />;
  }
  if (variant === "laptop") {
    return <LaptopMockup brand={brandName} labelBg={labelBg} labelColor={labelColor} />;
  }
  if (variant === "olive") {
    return <OliveBottleMockup brand={brandName} labelBg={labelBg} labelColor={labelColor} />;
  }
  if (variant === "tea") {
    return <TeaPouchMockup brand={brandName} labelBg={labelBg} labelColor={labelColor} />;
  }
  if (variant === "round") {
    return <RoundStickerMockup brand={brandName} labelBg={labelBg} labelColor={labelColor} />;
  }
  return <TubeMockup brand={brandName} labelBg={labelBg} labelColor={labelColor} />;
}

// ============================================================
// Variants
// ============================================================

function BottleMockup({
  brand,
  labelBg,
  labelColor,
}: {
  brand: string;
  labelBg: string;
  labelColor: string;
}) {
  return (
    <svg
      viewBox="0 0 200 220"
      width="100%"
      height="100%"
      style={{ maxWidth: 160 }}
      aria-hidden
    >
      {/* Şişe gölgesi */}
      <ellipse cx="100" cy="210" rx="50" ry="6" fill="rgba(0,0,0,0.12)" />
      {/* Şişe gövdesi */}
      <path
        d="M 70 30 L 70 50 Q 70 60 65 65 L 60 80 Q 55 90 55 105 L 55 195 Q 55 205 65 205 L 135 205 Q 145 205 145 195 L 145 105 Q 145 90 140 80 L 135 65 Q 130 60 130 50 L 130 30 Z"
        fill="#F5F5F0"
        stroke="rgba(31,41,55,0.18)"
        strokeWidth="1"
      />
      {/* Şişe ağzı */}
      <rect x="80" y="20" width="40" height="14" rx="2" fill="#3D3A35" />
      {/* Etiket */}
      <rect
        x="60"
        y="110"
        width="80"
        height="65"
        rx="3"
        fill={labelBg}
        stroke="rgba(0,0,0,0.06)"
        strokeWidth="0.5"
      />
      <text
        x="100"
        y="138"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="700"
        fontSize="13"
        fill={labelColor}
        letterSpacing="0.5"
      >
        {brand.toUpperCase().slice(0, 9)}
      </text>
      <line
        x1="72"
        y1="148"
        x2="128"
        y2="148"
        stroke={labelColor}
        strokeWidth="0.5"
        opacity="0.3"
      />
      <text
        x="100"
        y="162"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="500"
        fontSize="6"
        fill={labelColor}
        opacity="0.7"
        letterSpacing="0.6"
      >
        DOĞAL · 100ml
      </text>
      {/* Highlight */}
      <ellipse cx="78" cy="120" rx="6" ry="40" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function CoffeeMockup({
  brand,
  labelBg,
  labelColor,
}: {
  brand: string;
  labelBg: string;
  labelColor: string;
}) {
  return (
    <svg
      viewBox="0 0 200 220"
      width="100%"
      height="100%"
      style={{ maxWidth: 150 }}
      aria-hidden
    >
      <ellipse cx="100" cy="210" rx="55" ry="5" fill="rgba(0,0,0,0.12)" />
      {/* Poşet */}
      <path
        d="M 50 25 Q 50 20 55 20 L 145 20 Q 150 20 150 25 L 150 200 Q 150 205 145 205 L 55 205 Q 50 205 50 200 Z"
        fill="#3F2E26"
      />
      {/* Üst kıvrım */}
      <path
        d="M 50 25 Q 100 35 150 25 L 150 35 Q 100 45 50 35 Z"
        fill="rgba(0,0,0,0.2)"
      />
      {/* Etiket */}
      <rect
        x="65"
        y="80"
        width="70"
        height="90"
        rx="2"
        fill={labelBg}
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="0.5"
      />
      <text
        x="100"
        y="105"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="700"
        fontSize="11"
        fill={labelColor}
        letterSpacing="0.5"
      >
        {brand.toUpperCase().slice(0, 11)}
      </text>
      <text
        x="100"
        y="118"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="500"
        fontSize="5"
        fill={labelColor}
        opacity="0.6"
        letterSpacing="0.6"
      >
        ROASTERY
      </text>
      <line
        x1="78"
        y1="128"
        x2="122"
        y2="128"
        stroke={labelColor}
        strokeWidth="0.4"
        opacity="0.3"
      />
      <text
        x="100"
        y="145"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="600"
        fontSize="7"
        fill={labelColor}
        opacity="0.8"
      >
        SINGLE ORIGIN
      </text>
      <text
        x="100"
        y="158"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontSize="5"
        fill={labelColor}
        opacity="0.6"
      >
        250g
      </text>
      {/* Side seam */}
      <line
        x1="50"
        y1="25"
        x2="50"
        y2="200"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function LaptopMockup({
  brand,
  labelBg,
  labelColor,
}: {
  brand: string;
  labelBg: string;
  labelColor: string;
}) {
  return (
    <svg
      viewBox="0 0 240 180"
      width="100%"
      height="100%"
      style={{ maxWidth: 200 }}
      aria-hidden
    >
      <ellipse cx="120" cy="170" rx="80" ry="5" fill="rgba(0,0,0,0.15)" />
      {/* Laptop kapağı */}
      <path
        d="M 40 25 L 200 25 L 210 155 L 30 155 Z"
        fill="#C0C7CD"
        stroke="rgba(31,41,55,0.2)"
        strokeWidth="1"
      />
      {/* Kapak iç gölge */}
      <path
        d="M 50 35 L 190 35 L 198 145 L 42 145 Z"
        fill="#E5E9EE"
      />
      {/* Apple-vari nokta */}
      <circle cx="120" cy="90" r="3" fill="#9BA4AD" />
      {/* Sticker */}
      <g transform="translate(80, 60) rotate(-8)">
        <rect
          x="0"
          y="0"
          width="65"
          height="50"
          rx="6"
          fill={labelBg}
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="0.5"
          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
        />
        <text
          x="32.5"
          y="22"
          textAnchor="middle"
          fontFamily="-apple-system, sans-serif"
          fontWeight="700"
          fontSize="9"
          fill={labelColor}
          letterSpacing="0.4"
        >
          {brand.toUpperCase().slice(0, 8)}
        </text>
        <text
          x="32.5"
          y="35"
          textAnchor="middle"
          fontFamily="-apple-system, sans-serif"
          fontWeight="500"
          fontSize="5"
          fill={labelColor}
          opacity="0.6"
        >
          ATÖLYE
        </text>
      </g>
      {/* Klavye band */}
      <rect x="30" y="155" width="180" height="6" rx="2" fill="#9BA4AD" />
    </svg>
  );
}

function OliveBottleMockup({
  brand,
  labelBg,
  labelColor,
}: {
  brand: string;
  labelBg: string;
  labelColor: string;
}) {
  return (
    <svg
      viewBox="0 0 180 220"
      width="100%"
      height="100%"
      style={{ maxWidth: 130 }}
      aria-hidden
    >
      <ellipse cx="90" cy="210" rx="40" ry="5" fill="rgba(0,0,0,0.15)" />
      {/* Yuvarlak şişe */}
      <path
        d="M 75 25 L 75 55 Q 60 60 50 80 Q 40 100 40 130 L 40 195 Q 40 205 50 205 L 130 205 Q 140 205 140 195 L 140 130 Q 140 100 130 80 Q 120 60 105 55 L 105 25 Z"
        fill="#3D5A3F"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1"
      />
      {/* Mantar */}
      <rect x="73" y="14" width="34" height="14" rx="2" fill="#8B6F47" />
      <rect x="73" y="14" width="34" height="3" rx="1" fill="#6B5435" />
      {/* Etiket */}
      <rect
        x="48"
        y="120"
        width="84"
        height="60"
        rx="2"
        fill={labelBg}
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="0.5"
      />
      <text
        x="90"
        y="142"
        textAnchor="middle"
        fontFamily="serif"
        fontStyle="italic"
        fontWeight="600"
        fontSize="11"
        fill={labelColor}
      >
        {brand.split(" ")[0]}
      </text>
      <line
        x1="60"
        y1="150"
        x2="120"
        y2="150"
        stroke={labelColor}
        strokeWidth="0.4"
        opacity="0.4"
      />
      <text
        x="90"
        y="165"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="500"
        fontSize="6"
        fill={labelColor}
        opacity="0.7"
        letterSpacing="0.4"
      >
        SOĞUK SIKIM
      </text>
      <text
        x="90"
        y="174"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontSize="5"
        fill={labelColor}
        opacity="0.5"
      >
        500 ml · NATÜREL
      </text>
      {/* Highlight */}
      <ellipse cx="60" cy="100" rx="5" ry="50" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

function TeaPouchMockup({
  brand,
  labelBg,
  labelColor,
}: {
  brand: string;
  labelBg: string;
  labelColor: string;
}) {
  return (
    <svg
      viewBox="0 0 200 220"
      width="100%"
      height="100%"
      style={{ maxWidth: 150 }}
      aria-hidden
    >
      <ellipse cx="100" cy="210" rx="50" ry="5" fill="rgba(0,0,0,0.12)" />
      {/* Stand-up pouch */}
      <path
        d="M 55 25 Q 60 20 70 20 L 130 20 Q 140 20 145 25 L 150 50 L 150 195 Q 150 205 140 205 L 60 205 Q 50 205 50 195 L 50 50 Z"
        fill="#E8C99B"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1"
      />
      {/* Üst zip */}
      <line
        x1="55"
        y1="32"
        x2="145"
        y2="32"
        stroke="rgba(31,41,55,0.4)"
        strokeWidth="0.5"
        strokeDasharray="2,2"
      />
      {/* Etiket */}
      <rect
        x="62"
        y="60"
        width="76"
        height="120"
        rx="3"
        fill={labelBg}
        stroke="rgba(0,0,0,0.06)"
        strokeWidth="0.5"
      />
      {/* Yaprak ikon */}
      <path
        d="M 100 80 Q 95 70 90 80 Q 95 90 100 88 Q 105 90 110 80 Q 105 70 100 80 Z"
        fill="#3D5A3F"
        opacity="0.6"
      />
      <text
        x="100"
        y="115"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="700"
        fontSize="11"
        fill={labelColor}
        letterSpacing="0.5"
      >
        {brand.toUpperCase().slice(0, 10)}
      </text>
      <text
        x="100"
        y="130"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontSize="5"
        fill={labelColor}
        opacity="0.6"
        letterSpacing="0.4"
      >
        BİTKİ ÇAYLARI
      </text>
      <line
        x1="78"
        y1="142"
        x2="122"
        y2="142"
        stroke={labelColor}
        strokeWidth="0.4"
        opacity="0.3"
      />
      <text
        x="100"
        y="158"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="500"
        fontSize="6"
        fill={labelColor}
        opacity="0.8"
      >
        ADAÇAYI
      </text>
      <text
        x="100"
        y="172"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontSize="5"
        fill={labelColor}
        opacity="0.5"
      >
        50g · ORGANİK
      </text>
    </svg>
  );
}

function RoundStickerMockup({
  brand,
  labelBg,
  labelColor,
}: {
  brand: string;
  labelBg: string;
  labelColor: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width="100%"
      height="100%"
      style={{ maxWidth: 160 }}
      aria-hidden
    >
      {/* Gölge */}
      <ellipse cx="100" cy="180" rx="60" ry="8" fill="rgba(0,0,0,0.18)" />
      {/* Sticker — yuvarlak, hafif rotate */}
      <g transform="translate(100, 95) rotate(-7)">
        <circle
          cx="0"
          cy="0"
          r="65"
          fill={labelBg}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="0.5"
          filter="drop-shadow(0 8px 16px rgba(0,0,0,0.18))"
        />
        <text
          x="0"
          y="-6"
          textAnchor="middle"
          fontFamily="-apple-system, sans-serif"
          fontWeight="700"
          fontSize="14"
          fill={labelColor}
          letterSpacing="0.4"
        >
          {brand.toUpperCase().slice(0, 8)}
        </text>
        <line
          x1="-32"
          y1="3"
          x2="32"
          y2="3"
          stroke={labelColor}
          strokeWidth="0.5"
          opacity="0.4"
        />
        <text
          x="0"
          y="20"
          textAnchor="middle"
          fontFamily="-apple-system, sans-serif"
          fontWeight="500"
          fontSize="6"
          fill={labelColor}
          opacity="0.7"
          letterSpacing="0.6"
        >
          STICKER 2026
        </text>
        {/* Halo highlight */}
        <ellipse cx="-15" cy="-25" rx="20" ry="14" fill="rgba(255,255,255,0.3)" />
      </g>
    </svg>
  );
}

function TubeMockup({
  brand,
  labelBg,
  labelColor,
}: {
  brand: string;
  labelBg: string;
  labelColor: string;
}) {
  return (
    <svg
      viewBox="0 0 200 220"
      width="100%"
      height="100%"
      style={{ maxWidth: 130 }}
      aria-hidden
    >
      <ellipse cx="100" cy="210" rx="40" ry="5" fill="rgba(0,0,0,0.12)" />
      {/* Tüp */}
      <path
        d="M 70 25 L 70 200 Q 70 205 75 205 L 125 205 Q 130 205 130 200 L 130 25 Q 130 22 125 22 L 75 22 Q 70 22 70 25 Z"
        fill="#FFF8F0"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="1"
      />
      {/* Üst sıkıştırma */}
      <path
        d="M 70 25 L 75 18 L 125 18 L 130 25 Z"
        fill="rgba(0,0,0,0.1)"
      />
      {/* Kapak */}
      <rect x="78" y="5" width="44" height="14" rx="2" fill="#1F2335" />
      {/* Etiket */}
      <rect
        x="76"
        y="80"
        width="48"
        height="100"
        rx="2"
        fill={labelBg}
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="0.5"
      />
      <text
        x="100"
        y="105"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="700"
        fontSize="10"
        fill={labelColor}
        letterSpacing="0.5"
      >
        {brand.split(" ")[0].toUpperCase()}
      </text>
      <line
        x1="83"
        y1="115"
        x2="117"
        y2="115"
        stroke={labelColor}
        strokeWidth="0.4"
        opacity="0.3"
      />
      <text
        x="100"
        y="135"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontWeight="500"
        fontSize="5"
        fill={labelColor}
        opacity="0.65"
        letterSpacing="0.5"
      >
        SPOT UV
      </text>
      <text
        x="100"
        y="148"
        textAnchor="middle"
        fontFamily="-apple-system, sans-serif"
        fontSize="5"
        fill={labelColor}
        opacity="0.5"
      >
        50 ml
      </text>
      {/* Highlight */}
      <ellipse cx="82" cy="100" rx="3" ry="50" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}
