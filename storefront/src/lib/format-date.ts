/**
 * Pim Etiket — Tarih/saat formatlama helper'ı.
 *
 * Sefa 20 May v68 (Frontend agent P1 #9):
 * `toLocaleString("tr-TR", {...})` 30+ yerde timeZone parametresiz
 * kullanılıyordu. SSR Node.js UTC, browser TR (+3) — saat-içeren
 * formatlarda hydration mismatch (#418) tetikliyor; React satırı sessiz
 * düşürüyor. Çözüm: `Europe/Istanbul` default zone, tek doğruluk kaynağı.
 *
 * /admin/siparisler timezone fix (b7a0e29) bu pattern'i resmen kabul etti.
 * Bu helper yeni dosyalarda + eski toLocaleString çağrılarını migrate
 * ederken kullanılır.
 *
 * NOT: `toLocaleDateString` (sadece tarih, saat yok) hydration mismatch
 * RİSKİ TAŞIMAZ — tarih timezone bağımsız aynı görünür. Yine de tutarlılık
 * için bu helper kullanılabilir.
 */

const DEFAULT_TZ = "Europe/Istanbul";

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export interface FormatOpts extends Intl.DateTimeFormatOptions {
  locale?: string;
  fallback?: string;
}

/**
 * Tarih + saat (hydration-safe).
 * Default: "19 May 22:45" (TR locale, Europe/Istanbul).
 */
export function fmtDateTime(input: DateInput, opts: FormatOpts = {}): string {
  const d = toDate(input);
  if (!d) return opts.fallback ?? "—";
  const { locale = "tr-TR", fallback: _f, ...intlOpts } = opts;
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TZ,
    ...intlOpts,
  });
}

/**
 * Sadece tarih — hydration safe (zaten timezone fark etmez ama tutarlılık).
 * Default: "19 Mayıs 2026" (TR locale).
 */
export function fmtDate(input: DateInput, opts: FormatOpts = {}): string {
  const d = toDate(input);
  if (!d) return opts.fallback ?? "—";
  const { locale = "tr-TR", fallback: _f, ...intlOpts } = opts;
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: DEFAULT_TZ,
    ...intlOpts,
  });
}

/**
 * Sadece saat — Europe/Istanbul.
 * Default: "22:45".
 */
export function fmtTime(input: DateInput, opts: FormatOpts = {}): string {
  const d = toDate(input);
  if (!d) return opts.fallback ?? "—";
  const { locale = "tr-TR", fallback: _f, ...intlOpts } = opts;
  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TZ,
    ...intlOpts,
  });
}

/**
 * "az önce", "5 dk önce", "3 sa önce" relative time.
 * 7 günden eski ise fmtDate fallback.
 */
export function fmtRelative(input: DateInput, opts: FormatOpts = {}): string {
  const d = toDate(input);
  if (!d) return opts.fallback ?? "—";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return fmtDate(d, opts);
}
