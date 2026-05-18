/**
 * Türkiye Resmi Tatil Takvimi — 2026 + 2027 (sabit + hareketli).
 *
 * Sefa 18 May v68:
 * deliveryEstimate() ve admin kargo paneli için resmi tatil günlerini
 * iş günü hesabından çıkarır.
 *
 * Kaynak: T.C. Cumhurbaşkanlığı / Diyanet ay başlama tarihleri
 *
 * NOT: Dini bayramlar (Ramazan, Kurban) hicri takvime göre değişir,
 * her yıl güncellenmeli. 2028+ için bu dosya yenilenmeli.
 *
 * Yarım günler (örn 28 Ekim, 31 Aralık) İŞ GÜNÜ sayılır — sadece tam
 * tatil olan günler liste'de.
 */

/**
 * ISO date string'leri (YYYY-MM-DD) resmi tatil günleri.
 * Set olarak tutuluyor — O(1) lookup.
 */
export const TURKEY_HOLIDAYS_2026_2027 = new Set<string>([
  // ============================================================
  // 2026 RESMİ TATİLLER
  // ============================================================
  // Sabit tatiller
  "2026-01-01", // Yılbaşı
  "2026-04-23", // 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı
  "2026-05-01", // 1 Mayıs Emek ve Dayanışma Günü
  "2026-05-19", // 19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı
  "2026-07-15", // 15 Temmuz Demokrasi ve Milli Birlik Günü
  "2026-08-30", // 30 Ağustos Zafer Bayramı
  "2026-10-29", // 29 Ekim Cumhuriyet Bayramı

  // Ramazan Bayramı 2026 (20-22 Mart Cuma-Cmt-Pzr → 23 Mart Pzt arefe köprü? Hayır, Pzr-Sal)
  // 2026 Ramazan: 19 Mart arefe (yarım gün), 20-22 Mart bayram
  "2026-03-20", // Ramazan 1. gün
  "2026-03-21", // Ramazan 2. gün
  "2026-03-22", // Ramazan 3. gün

  // Kurban Bayramı 2026: 26 Mayıs arefe (yarım gün), 27-30 Mayıs bayram
  "2026-05-27", // Kurban 1. gün
  "2026-05-28", // Kurban 2. gün
  "2026-05-29", // Kurban 3. gün
  "2026-05-30", // Kurban 4. gün

  // ============================================================
  // 2027 RESMİ TATİLLER (tahmini, kesinleştirilince güncellenir)
  // ============================================================
  "2027-01-01", // Yılbaşı
  "2027-04-23",
  "2027-05-01",
  "2027-05-19",
  "2027-07-15",
  "2027-08-30",
  "2027-10-29",

  // Ramazan Bayramı 2027 (tahmini 9-11 Mart)
  "2027-03-09",
  "2027-03-10",
  "2027-03-11",

  // Kurban Bayramı 2027 (tahmini 16-19 Mayıs)
  "2027-05-16",
  "2027-05-17",
  "2027-05-18",
  "2027-05-19", // bu 19 Mayıs ile çakışıyor, sayılmaz çift
]);

/**
 * Türkiye için bir tarih iş günü mü?
 * - Cumartesi/Pazar değil
 * - Resmi tatil değil
 */
export function isTurkeyBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Pzr, 6 = Cmt
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const iso = formatDateISO(date);
  if (TURKEY_HOLIDAYS_2026_2027.has(iso)) return false;

  return true;
}

/**
 * Bir tarihe N iş günü ekle (weekend + resmi tatil atla).
 */
export function addBusinessDays(start: Date, businessDays: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    if (isTurkeyBusinessDay(d)) {
      added++;
    }
  }
  return d;
}

/**
 * Bir tarih resmi tatil mi? (sadece resmi tatil — weekend hariç)
 */
export function isTurkeyHoliday(date: Date): boolean {
  const iso = formatDateISO(date);
  return TURKEY_HOLIDAYS_2026_2027.has(iso);
}

/**
 * Belirli tarih aralığındaki resmi tatil günlerini döndür.
 */
export function getHolidaysInRange(start: Date, end: Date): string[] {
  const result: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    const iso = formatDateISO(d);
    if (TURKEY_HOLIDAYS_2026_2027.has(iso)) {
      result.push(iso);
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

/**
 * Sonraki resmi tatil + adı.
 */
export const HOLIDAY_NAMES_TR: Record<string, string> = {
  "01-01": "Yılbaşı",
  "04-23": "23 Nisan Çocuk Bayramı",
  "05-01": "Emek ve Dayanışma Günü",
  "05-19": "19 Mayıs Atatürk'ü Anma Bayramı",
  "07-15": "Demokrasi ve Milli Birlik Günü",
  "08-30": "Zafer Bayramı",
  "10-29": "Cumhuriyet Bayramı",
  // Ramazan/Kurban için dinamik handle
};

export function getNextHoliday(
  from: Date = new Date()
): { date: Date; name: string } | null {
  const sorted = Array.from(TURKEY_HOLIDAYS_2026_2027).sort();
  for (const iso of sorted) {
    const d = new Date(iso + "T00:00:00+03:00");
    if (d > from) {
      const mmdd = iso.slice(5);
      const name = HOLIDAY_NAMES_TR[mmdd] ?? guessReligiousName(iso);
      return { date: d, name };
    }
  }
  return null;
}

function guessReligiousName(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  // Ramazan: Mart ayında 3 günlük blok (20-22 Mart 2026)
  if (month === 3 && day >= 18 && day <= 25) {
    return "Ramazan Bayramı";
  }
  // Kurban: Mayıs sonu - Haziran başı 4 günlük blok
  if ((month === 5 && day >= 26) || (month === 6 && day <= 5)) {
    return "Kurban Bayramı";
  }
  if (month === 3 && year === 2027) {
    return "Ramazan Bayramı (tahmini)";
  }
  if (month === 5 && year === 2027) {
    return "Kurban Bayramı (tahmini)";
  }
  return "Resmi tatil";
}

// ============================================================
// Helpers
// ============================================================
function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
