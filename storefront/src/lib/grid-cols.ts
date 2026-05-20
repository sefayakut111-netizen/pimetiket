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

export function gridColsForCount(count: number): string {
  switch (count) {
    case 1:
      return "grid grid-cols-1";
    case 2:
      return "grid grid-cols-1 sm:grid-cols-2";
    case 3:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    case 4:
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
    case 5:
      // 5 kart → 5 col tek satır lg (etiket 2-sütun layout'ta yarım sayfa
      // dar ama boş hücre yok, Sefa kuralı: doldur).
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5";
    case 6:
      // 6 kart → 3×2 lg (3 col tek satır 6 col'dan daha okunaklı,
      // boşluk yine yok).
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    case 7:
    case 8:
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    case 9:
      // 9 → 3×3
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3";
    case 10:
      // 10 → 5×2
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
    case 11:
    case 12:
      // 11/12 → 4 col (4+4+3 veya 4×3 dengeli)
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    default:
      // 13+ kart — default 4 col
      return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  }
}
