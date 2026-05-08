/**
 * PimAsset — 3 mascot varyasyonu için raster image wrapper.
 *
 * Kaynak (renkli, transparent PNG):
 *   /pim/pim-detailed.png  → tek baykuş tam karakter (Hero, CTA)
 *   /pim/pim-icon.png      → sadece kafa (favicon, mini avatar)
 *   /pim/pim-logo.png      → mascot + "pim etiket" wordmark (topbar, footer)
 *
 * NOT: SVG yedekleri /pim/*.svg yolunda; ancak path-traced sırasında renkler
 * kayboldu (sadece siyah path). Renk gelene kadar PNG'leri kullanıyoruz.
 * SVG'ler ileride renkli illüstratör çıktısıyla değiştirilecek.
 */

import { cn } from "@/lib/cn";

export type PimVariant = "detailed" | "icon" | "logo";

const SOURCES: Record<
  PimVariant,
  { src: string; aspect: number }
> = {
  detailed: { src: "/pim/pim-detailed.png", aspect: 1 },
  icon: { src: "/pim/pim-icon.png", aspect: 1 },
  logo: { src: "/pim/pim-logo.png", aspect: 1920 / 500 }, // ~3.84:1
};

interface PimAssetProps {
  variant?: PimVariant;
  size?: number; // longest side (px)
  bob?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function PimAsset({
  variant = "detailed",
  size = 300,
  bob = true,
  className,
  ariaLabel,
}: PimAssetProps) {
  const { src, aspect } = SOURCES[variant];
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `Pim baykuş (${variant})`}
      className={cn(
        "inline-block leading-none align-top",
        bob && "animate-pim-bob",
        className
      )}
      style={{ width: w, height: h }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
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
