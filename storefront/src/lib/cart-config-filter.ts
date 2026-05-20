/**
 * Cart config string filter — Sefa 20-21 May v68 (test geri bildirim).
 *
 * Sorun: cart item.config string'inde fiyata etki etmeyen üretim teknik
 * bilgileri (Sarım yönü, Göbek çapı, rulodaki adet, "Özelleştirme yok"
 * negatif bilgisi) kullanıcıyı yoruyor — sepet/ödeme özetinde kalabalık.
 *
 * Çözüm: Tek-doğru-kaynak filter. Sepet kartı, ödeme özeti ve gelecekteki
 * herhangi başka cart-item display noktası buradan geçer.
 *
 * Filtre kuralları:
 *   - "Özelleştirme yok" → negatif bilgi, sil
 *   - "Sarım N" → üretim detayı (göbek + sarım sipariş onayında görünür)
 *   - "Göbek N" → aynı
 *   - "N adet/rulo" → aynı
 */

/**
 * Config string'ini "·" ile böler, fiyata etki etmeyen parçaları filtreler,
 * temiz chip listesi döner.
 */
export function parseConfigChips(config: string): string[] {
  return config
    .split(/\s·\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/özelleştirme\s*yok/i.test(s))
    .filter((s) => !/^sarım\s/i.test(s))
    .filter((s) => !/göbek/i.test(s))
    .filter((s) => !/adet\/rulo/i.test(s));
}

/**
 * Config string'ini direkt yeniden birleştirilmiş "·" ayraçlı string olarak
 * döner — JSX'te chip yerine inline text gösterilen yerler için
 * (örn. ödeme sipariş özeti tek satır gösterimi).
 */
export function filterConfigString(config: string): string {
  return parseConfigChips(config).join(" · ");
}
