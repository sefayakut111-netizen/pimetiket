/**
 * PimAsset — 3 mascot varyasyonu için image wrapper.
 *
 * Kaynak (Sefa'nın illüstratör çıktıları, SVG):
 *   /pim/pim-detailed.svg  → tek baykuş tam karakter (Hero, CTA)
 *   /pim/pim-icon.svg      → sadece kafa (favicon, mini avatar)
 *   /pim/pim-logo.svg      → mascot + "pim etiket" wordmark (topbar, footer)
 *
 * SVG'ler şu an path-traced sırasında siyah olarak gelmiş; Sefa renk
 * kodlarını sonra düzeltecek. Renkli versiyon production'a aynı yolla
 * gidecek (PimAsset değişmez).
 *
 * PNG/JPG yedekleri yine /pim/* altında duruyor.
 */

import { cn } from "@/lib/cn";

export type PimVariant = "detailed" | "icon" | "logo";

const SOURCES: Record<
  PimVariant,
  { src: string; aspect: number }
> = {
  detailed: { src: "/pim/pim-detailed.svg", aspect: 1 },
  icon: { src: "/pim/pim-icon.svg", aspect: 1 },
  logo: { src: "/pim/pim-logo.svg", aspect: 1920 / 500 }, // ~3.84:1
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
