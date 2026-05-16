/**
 * Centralized price formatter — Pim Etiket.
 *
 * Sefa kuralı (16 May denetim #12 — multi-currency):
 *   Şu an sistem sadece TRY destekliyor (pricing engine, PayTR, KDV
 *   hesaplamaları, e-arşiv fatura, fason muhasebesi). Multi-currency
 *   ne backend ne payment provider seviyesinde hazır değil; dolayısıyla
 *   "$" işareti EN locale'de gösterilmiyor — hâlâ TL gösteriliyor.
 *
 *   Bu modül **yalnızca formatter merkezileştirmesi**: gelecekte çoklu
 *   para birimi açıldığında (sterlin/euro müşteri varsa ihracat) tek
 *   yerde değişim yapılır. Şu anda tüm sayfalardaki dağınık
 *   `toFixed(2).replace(".", ",")` + "TL" kombinasyonlarını buraya
 *   yönlendirmek bir sonraki dalganın işi.
 *
 * Kullanım örnekleri:
 *   formatPrice(1234.5)            → "1.234,50 TL"
 *   formatPrice(1234.5, "TL/adet") → "1.234,50 TL/adet"
 *   formatPrice(0.85, "TL/adet")   → "0,85 TL/adet"
 *   formatPriceShort(1234.5)       → "1.234,50"   (suffix yok, KDV satırı vb.)
 */

import type { Locale } from "@/lib/i18n/types";

/** Çeşitli yerlerde "TL" suffix ile birlikte kullanılan kompakt format. */
export function formatPrice(
  amount: number,
  suffix: string = "TL",
  locale: Locale = "tr"
): string {
  const num = formatPriceShort(amount, locale);
  return suffix ? `${num} ${suffix}` : num;
}

/** Sadece sayı kısmı (TR locale virgül ondalık, nokta binlik). */
export function formatPriceShort(
  amount: number,
  locale: Locale = "tr"
): string {
  if (!Number.isFinite(amount)) return "—";
  if (locale === "tr") {
    return amount.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // en locale — yine TL gösteriyoruz (multi-currency hazır olunca güncellenir)
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Birim fiyat: "0,85 TL/adet" */
export function formatUnitPrice(
  amount: number,
  locale: Locale = "tr"
): string {
  return formatPrice(amount, locale === "en" ? "TL/unit" : "TL/adet", locale);
}

/** "₺" sembol formatı — yan-sıra gösterimi gereken yerlerde. */
export function formatPriceSymbol(
  amount: number,
  locale: Locale = "tr"
): string {
  return `₺${formatPriceShort(amount, locale)}`;
}
