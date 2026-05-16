/**
 * Pim Etiket — Format helpers (TR/EN locale-aware).
 *
 * Sefa 17 May Site denetim raporu:
 *   P1-14: Birim fiyat 4 hane vs 2 hane sapma (/etiket "2,5079" → /sepet "2,51")
 *   P1-15: Tarih format tutarsız ("17 May" vs "17 Mayıs" vs "17 MAYIS")
 *
 * Tek standart formatter — her yerde bu kullanılırsa tutarsızlık olmaz.
 */

export type AppLocale = "tr" | "en";

const LOCALE_TAGS: Record<AppLocale, string> = {
  tr: "tr-TR",
  en: "en-US",
};

// ============================================================
// Currency (TL / TRY)
// ============================================================

/**
 * Para formatı — 2 ondalık zorunlu, kuruş gösterimi.
 * Örn: 1520 → "1.520,00", 2.5079 → "2,51"
 */
export function formatCurrency(
  amount: number,
  locale: AppLocale = "tr"
): string {
  return amount.toLocaleString(LOCALE_TAGS[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Birim fiyat (kuruş hassas) — 2 ondalık.
 * Eski kod 4 ondalık ("2,5079") gösteriyordu, kullanıcı kafası karıştı.
 */
export function formatUnitPrice(
  amount: number,
  locale: AppLocale = "tr"
): string {
  return formatCurrency(amount, locale);
}

/**
 * Yuvarlanmış tam para — totaller için (kuruşsuz görünüm istediğin yer).
 * Sepet sayfası kullanır.
 */
export function formatPriceRounded(
  amount: number,
  locale: AppLocale = "tr"
): string {
  return Math.round(amount).toLocaleString(LOCALE_TAGS[locale]);
}

// ============================================================
// Date — TR full month, EN abbrev
// ============================================================

/**
 * Tarih — TR'de "17 Mayıs 2026", EN'de "17 May 2026".
 * Tek standart format: gün + ay + yıl, abbrev YOK (sadece EN'de bu OK).
 */
export function formatDate(
  date: Date | string,
  locale: AppLocale = "tr"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  if (locale === "tr") {
    // "17 Mayıs 2026"
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  // "17 May 2026"
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Kısa tarih (chip / mobil için): "17 May 2026 PAZAR" → "17 May 2026 · PAZ"
 * Sefa P2-19: panelim chip "17 MAYIS PAZAR" yıl yok hatası.
 */
export function formatDateWithWeekday(
  date: Date | string,
  locale: AppLocale = "tr"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const tag = LOCALE_TAGS[locale];
  const base = d.toLocaleDateString(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const weekday = d.toLocaleDateString(tag, { weekday: "long" });
  return `${base} · ${weekday}`;
}

/**
 * Saat — "14:32"
 */
export function formatTime(
  date: Date | string,
  locale: AppLocale = "tr"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(LOCALE_TAGS[locale], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Tarih + saat — "17 Mayıs 2026, 14:32"
 */
export function formatDateTime(
  date: Date | string,
  locale: AppLocale = "tr"
): string {
  return `${formatDate(date, locale)}, ${formatTime(date, locale)}`;
}
