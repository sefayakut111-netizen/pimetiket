/**
 * MaskotPlaceholder — Pim Etiket karga maskotu (default tasarım yokken).
 *
 * Sefa kuralı (18 May v67): Etiket/sticker mockup'larında müşteri
 * tasarımı yüklemediği sürece bu maskot merkezde durur, "buraya
 * tasarımın gelecek" mesajını taşır. Tasarım yüklenince fade-out
 * yapar (caller component yönetir).
 *
 * `pim-etiket-mark-light.svg` (mercan göz, krem gövde) kullanır.
 * Yarı saydam (opacity 0.5) — mockup'ın arkasından hafifçe görünür,
 * gerçek tasarım yüklenince ön planda olmadığı anlaşılır.
 */

interface MaskotPlaceholderProps {
  /** Container'ın yüzde kaçını maskot kaplasın (varsayılan 55) */
  sizePct?: number;
  /** Yarı saydamlık — Sefa 18 May v68: default 1 (tam renk). */
  opacity?: number;
  /** Geriye uyumluluk — theme IGNORE ediliyor, tüm kargalar lacivert. */
  theme?: "light" | "dark";
  /** A11y label */
  label?: string;
  /** Sefa 18 May v68 (3): Karganın altında "Pim Etiket" markası göster.
   *  Etiket önizlemelerinde true (etikette yazı yaygın), sticker'da false
   *  (eğlence amaçlı, sade karga). */
  showBrand?: boolean;
}

export function MaskotPlaceholder({
  sizePct = 55,
  opacity = 1,
  label = "Tasarımın buraya gelecek",
  showBrand = false,
}: MaskotPlaceholderProps) {
  // Sefa 18 May v68 (8): Container queries yerine TEK SVG yaklaşımı.
  // - showBrand=true  → mark-with-text.svg (karga + "Pim Etiket" tek SVG)
  //   preserveAspectRatio="xMidYMid meet" default → her container'da garantili
  //   orantılı scale, sünme/clip yok.
  // - showBrand=false → mark-dark.svg (sade karga)
  const src = showBrand
    ? "/pim/pim-etiket-mark-with-text.svg"
    : "/pim/pim-etiket-mark-dark.svg";

  // showBrand=true SVG aspect 158:168 (~0.94), showBrand=false 158:120 (~1.32)
  return (
    <div
      className="absolute inset-0 grid place-items-center pointer-events-none select-none transition-opacity duration-300"
      style={{
        opacity,
        padding: "6%",
      }}
      role="img"
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{
          width: `${sizePct}%`,
          height: `${sizePct}%`,
          objectFit: "contain",
        }}
      />
    </div>
  );
}
