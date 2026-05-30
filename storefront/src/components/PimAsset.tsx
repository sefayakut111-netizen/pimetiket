/**
 * PimAsset — mascot/logo wrapper.
 *
 * Sefa 17 May v24: Yeni logo seti (Bricolage Grotesque + mark/lockup).
 *
 * Kaynak dosyalar:
 *   /pim/pim-etiket-mark-dark.svg     → sadece karga sembolü (koyu, açık zeminler)
 *   /pim/pim-etiket-mark-light.svg    → sadece karga sembolü (krem, koyu zeminler)
 *   /pim/pim-etiket-lockup-light-bg.svg → mascot + "pim etiket" wordmark (açık zemin)
 *   /pim/pim-etiket-lockup-dark-bg.svg  → mascot + "pim etiket" wordmark (koyu zemin)
 *
 * Variant + bg matrisi:
 *   variant="logo" bg="light" → lockup-light-bg (TopBar, açık sidebar)
 *   variant="logo" bg="dark"  → lockup-dark-bg  (Footer lacivert, dark overlay)
 *   variant="icon" bg="light" → mark-dark       (admin sidebar beyaz, light card)
 *   variant="icon" bg="dark"  → mark-light      (mercan/lacivert chat button)
 *
 * Backward compat: variant="detailed" → icon olarak alias'lanır (eski Pim
 * component'i kullanıyor; yeni set'te "detailed" karşılığı yok).
 */

import Image from "next/image";
import { cn } from "@/lib/cn";

export type PimVariant = "detailed" | "icon" | "logo";
export type PimBg = "light" | "dark";

type AssetEntry = { src: string; aspect: number };

/** variant × bg → asset.
 *  - aspect: width/height. logo = 690/240 ≈ 2.875, icon = 1 (kare). */
const ASSETS: Record<PimVariant, Record<PimBg, AssetEntry>> = {
  logo: {
    light: { src: "/pim/pim-etiket-lockup-light-bg.svg", aspect: 690 / 240 },
    dark: { src: "/pim/pim-etiket-lockup-dark-bg.svg", aspect: 690 / 240 },
  },
  icon: {
    // Açık zemin → koyu mark · Koyu zemin → açık mark
    light: { src: "/pim/pim-etiket-mark-dark.svg", aspect: 1 },
    dark: { src: "/pim/pim-etiket-mark-light.svg", aspect: 1 },
  },
  // detailed → icon alias'ı (eski Pim component'i için backward compat)
  detailed: {
    light: { src: "/pim/pim-etiket-mark-dark.svg", aspect: 1 },
    dark: { src: "/pim/pim-etiket-mark-light.svg", aspect: 1 },
  },
};

interface PimAssetProps {
  variant?: PimVariant;
  /** Zemin rengi. "light" = açık zemin → koyu logo göster.
   *  "dark" = koyu zemin → açık logo göster. */
  bg?: PimBg;
  size?: number; // longest side (px)
  bob?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Header gibi above-the-fold logo için LCP optimizasyonu */
  priority?: boolean;
}

export function PimAsset({
  variant = "detailed",
  bg = "light",
  size = 300,
  bob = true,
  className,
  ariaLabel,
  priority = false,
}: PimAssetProps) {
  const { src, aspect } = ASSETS[variant][bg];
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `Pim Etiket logo (${variant})`}
      className={cn(
        "inline-block leading-none align-top",
        bob && "animate-pim-bob",
        className
      )}
      style={{ width: w, height: h }}
    >
      {/* Sefa 21 May v68 (Image migration #2): <img> → Next/Image.
          SVG'ler unoptimized — Next optimizer SVG'leri PNG'ye çevirmesin
          (gradient/clip-path detayları kaybolmasın). */}
      <Image
        src={src}
        alt=""
        width={Math.round(w)}
        height={Math.round(h)}
        draggable={false}
        unoptimized
        priority={priority}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}
