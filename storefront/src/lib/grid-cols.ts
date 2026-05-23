/**
 * Pim Etiket — kart grid sütun helper'ı.
 *
 * Sefa 20 May v68 kuralı: "kart sayısı kadar sütun kullan, sığar şekilde
 * doldur, boş hücre kalmasın". 5 kart varsa 5 sütun, 6 kart varsa 3×2
 * dengeli, vs. Tüm konfigüratör grid sayfaları aynı kuralı paylaşır.
 *
 * Tailwind static class string döner — purge-safe. Dinamik
 * `grid-cols-${n}` purge sorunu yapar, switch ile explicit class.
 *
 * Mobile-first: 1 → sm 2 → lg breakpoint kart sayısına göre.
 */

// Sefa 23 May v68: mobile baseline `grid-cols-1` → `grid-cols-2` (Sefa
// karari: konfigüratör malzeme/şekil kartları mobilde tek tek çok büyük
// gözüküyor, 2'şerli daha sıkışık ve hızlı tarama sağlar). Case 1 (tek
// kart) için 1 sütun korunur (tek kartın sağda boş kalması garip).
export function gridColsForCount(count: number): string {
  switch (count) {
    case 1:
      // Tek kart varsa 1 sütun (sağda boş kalmasın)
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    case 2:
      // Sefa 21 May v68 (görsel feedback): 2 kart varken sm/lg'de daha
      // geniş grid — Sefa 23 May v68: mobile 2 sütun
      return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3";
    case 3:
      return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3";
    case 4:
      return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4";
    case 5:
      // 5 kart → 5 col tek satır lg (etiket 2-sütun layout'ta yarım sayfa
      // dar ama boş hücre yok, Sefa kuralı: doldur).
      return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5";
    case 6:
      // 6 kart → 3×2 lg (3 col tek satır 6 col'dan daha okunaklı,
      // boşluk yine yok). Mobile 2 sütun → 3 satır.
      return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3";
    case 7:
    case 8:
      return "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    case 9:
      // 9 → 3×3 lg, mobile 2 sütun → 5 satır (son satır 1 kart)
      return "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3";
    case 10:
      // 10 → 5×2 lg, mobile 2 sütun → 5 satır
      return "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
    case 11:
    case 12:
      // 11/12 → 4 col lg
      return "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    default:
      // 13+ kart — default 4 col
      return "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  }
}
