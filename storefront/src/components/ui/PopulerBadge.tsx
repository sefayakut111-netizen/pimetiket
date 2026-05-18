/**
 * PopulerBadge — Standart "Popüler" rozet (UX uzman 2.3).
 *
 * Sefa 18 May v68: Önceki tutarsızlık — etiket'te kırmızı dolu daire içinde
 * ★, sticker'da inline ⭐ emoji. İki farklı görsel + anlamı belirsiz.
 *
 * Standardize: Tek pattern — sağ üst absolute pim-mercan dolu daire + ★ +
 * title attribute (hover tooltip). aria-label ile ekran okuyucu erişimi.
 *
 * Kullanım:
 *   <div className="relative">
 *     <PopulerBadge />
 *     <SelectableCard ... />
 *   </div>
 *
 * Veya inline (yan yana chip için):
 *   <PopulerBadge variant="inline" />
 */

interface PopulerBadgeProps {
  /** "corner" = sağ üst absolute (kart üstü), "inline" = yan yana (chip içi) */
  variant?: "corner" | "inline";
  /** Tooltip metni (hover'da görünür) — varsayılan "En çok seçilen" */
  tooltip?: string;
  /** aria-label — varsayılan "Popüler" */
  ariaLabel?: string;
}

export function PopulerBadge({
  variant = "corner",
  tooltip = "En çok seçilen — kullanıcıların büyük çoğunluğu bunu tercih ediyor",
  ariaLabel = "Popüler",
}: PopulerBadgeProps) {
  if (variant === "inline") {
    return (
      <span
        aria-label={ariaLabel}
        title={tooltip}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pim-mercan text-white text-[9px] leading-none shadow-1 ring-1 ring-white ml-1.5"
      >
        ★
      </span>
    );
  }

  return (
    <span
      aria-label={ariaLabel}
      title={tooltip}
      className="absolute -top-1.5 -right-1.5 z-10 grid place-items-center w-5 h-5 rounded-full bg-pim-mercan text-white text-[11px] leading-none shadow-1 ring-2 ring-white"
    >
      ★
    </span>
  );
}
