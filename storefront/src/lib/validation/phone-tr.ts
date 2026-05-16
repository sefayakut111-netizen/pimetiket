/**
 * Türkiye telefon numarası parsing/format helpers.
 *
 * Sefa 17 May Site denetim raporu P0-1:
 * "+905551234567" paste edilince eski kod `replace(/\D/g, "").slice(0, 10)`
 * → "9055512345" (alan kodu kalıyor, son 3 hane kesiliyor) hatasıydı.
 *
 * Bu helper farklı input format'larını destekler:
 *   +90 555 123 45 67  → 5551234567
 *   +905551234567       → 5551234567
 *   0 555 123 45 67    → 5551234567
 *   05551234567         → 5551234567
 *   90 555 123 45 67   → 5551234567
 *   555 123 45 67      → 5551234567
 *   5551234567          → 5551234567
 */

/**
 * Input string'i 10 haneli TR mobil/sabit numaraya temizler.
 * Boş input → boş string. 10 haneden az olunca olduğu kadarını döner.
 */
export function parseTrPhoneToLocal(input: string): string {
  // 1. Sadece rakam bırak
  let digits = input.replace(/\D/g, "");

  // 2. +90 / 90 ülke kodu varsa kaldır (12+ hane senaryosu)
  if (digits.startsWith("90") && digits.length >= 11) {
    digits = digits.slice(2);
  }

  // 3. Türk numaralarda yaygın "0" prefix (örn. "05551234567")
  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }

  // 4. Max 10 hane
  return digits.slice(0, 10);
}

/**
 * 10-haneli yerel numarayı DB'ye yazılacak +90 formatına çevir.
 * Boş input → boş string.
 */
export function formatTrPhoneForDb(local10: string): string {
  const clean = parseTrPhoneToLocal(local10);
  if (clean.length === 0) return "";
  return `+90${clean}`;
}

/**
 * DB'deki +905XXXXXXXXX format'ından input'a (10-hane lokal) çevir.
 */
export function dbPhoneToInputValue(dbValue: string | null | undefined): string {
  if (!dbValue) return "";
  return parseTrPhoneToLocal(dbValue);
}
