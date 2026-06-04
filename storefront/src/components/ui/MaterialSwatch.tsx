/**
 * MaterialSwatch — yüzey/malzeme doku swatch'ı.
 *
 * Sefa 18 May v67: Photorealistic SVG surface textures (kuşe, kraft,
 * ultra clear, metalik, holografik, sıcak yaldız, soft-touch, emboss,
 * spot UV, vb.) entegre edildi. Önceki düz `background: gradient`
 * yerine gerçek malzeme hissi veren SVG dokuları gösterir.
 *
 * Kullanım:
 *   <MaterialSwatch surface="kuse" />            // tam SVG doku
 *   <MaterialSwatch surface="ozyok" />            // özelleştirme yok
 *   <MaterialSwatch fallback="#FFF" />            // legacy fallback
 *
 * SVG'ler `public/assets/svg/surfaces/<id>.svg` altında 220×110 pill
 * boyutunda hazırlanmış. `<img>` ile lazy yüklenir (browser cache
 * sayesinde tek seferlik network çağrısı).
 */

import type { CSSProperties } from "react";
import Image from "next/image";

export type SurfaceId =
  | "kuse"
  | "kraft"
  | "ultraclear"
  | "transparan"
  | "metalik"
  | "holografik"
  | "opakfolyo"
  | "opakpp"
  | "simli"
  | "sicakyaldiz"
  | "spotuv"
  | "emboss"
  | "softtouch"
  | "matselefon"
  | "parlakselefon"
  | "kaplamasiz"
  | "ozyok";

interface MaterialSwatchProps {
  /** Sefa 3 Haz v69: Tam görsel yolu (raster/foto). Verilirse `surface`tan
   *  ÖNCELİKLİDİR. Yalnız sticker konfigüratörü malzeme adımı kullanır;
   *  etiket + finish swatch'ları `surface` (SVG) ile devam eder. */
  src?: string | null;
  /** SVG doku ID — `public/assets/svg/surfaces/<id>.svg` */
  surface?: SurfaceId | null;
  /** Legacy CSS background — surface yoksa fallback */
  fallback?: string;
  /** Ek className (boyut, margin, vb.) */
  className?: string;
  /** Köşe yuvarlama — varsayılan "lg" */
  rounded?: "md" | "lg" | "xl" | "2xl" | "pill";
  /** Inline style override */
  style?: CSSProperties;
  /** A11y label — ekran okuyucu için */
  label?: string;
  /** Sefa 18 May v68: SVG fit modu.
   *  - "cover" (varsayılan): SVG container'ı doldurur, taşan kırpılır.
   *    Container aspect-[2/1] (SVG native) ise distortion olmaz.
   *  - "contain": SVG aspect'ini korur, boşluk arka planda kalır.
   *    Kare swatch'larda (1:1) SVG 2:1 olduğu için boşluk olur. */
  fit?: "cover" | "contain";
}

const ROUNDED_CLS: Record<NonNullable<MaterialSwatchProps["rounded"]>, string> = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  pill: "rounded-full",
};

export function MaterialSwatch({
  src,
  surface,
  fallback,
  className = "",
  rounded = "lg",
  style,
  label,
  fit = "cover",
}: MaterialSwatchProps) {
  const roundedCls = ROUNDED_CLS[rounded];
  const base = `relative overflow-hidden ring-1 ring-black/[0.06] ${roundedCls} ${className}`;
  const objectFitClass = fit === "contain" ? "object-contain" : "object-cover";

  // Sefa 3 Haz v69: tam yol raster görsel — surface'tan öncelikli
  if (src) {
    return (
      <div
        className={base}
        style={style}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 768px) 45vw, 220px"
          loading="eager"
          decoding="async"
          className={objectFitClass}
        />
      </div>
    );
  }

  if (surface) {
    return (
      <div
        className={base}
        style={style}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {/* Sefa 21 May v68 (Image migration faz 3b): Next/Image — SVG
            unoptimized (Next optimizer SVG'leri PNG'ye çevirmesin, doku
            detayları kaybolmasın). fill ile container'a tam oturur. */}
        <Image
          src={`/assets/svg/surfaces/${surface}.svg`}
          alt=""
          aria-hidden="true"
          fill
          unoptimized
          loading="lazy"
          decoding="async"
          className={objectFitClass}
        />
      </div>
    );
  }

  // Fallback: legacy gradient/solid CSS background
  return (
    <div
      className={base}
      style={{ ...style, background: fallback }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
