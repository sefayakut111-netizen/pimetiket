/**
 * Pim Etiket — Kargo şirketi helpers.
 *
 * Sefa 17 May Migration 045 ile birlikte:
 *   - DB tablosu: shipment_carriers (8 yurt içi kargo seed)
 *   - DB RPC: fn_list_carriers (UI dropdown için)
 *   - DB RPC: fn_get_my_order_shipment (müşteri görünümü)
 *
 * Bu lib:
 *   - Carrier code → display name & tracking URL build
 *   - Free-text fallback (DB'de yoksa)
 *
 * Tasarım kararı: DB tek doğru kaynak, ama UI render için seed liste
 * hardcoded fallback olarak burada da var. DB unreachable olsa bile UI
 * çalışır.
 */

export interface CarrierMeta {
  code: string;
  displayName: string;
  trackingUrlTemplate: string | null;
}

/**
 * Sefa 17 May: SADECE Yurtiçi Kargo ile çalışılıyor (tek anlaşma).
 * Migration 045'teki seed ile aynı. DB unreachable senaryosu için
 * SSR fallback. Aktif source-of-truth: DB tablosu.
 *
 * İleride 2. kargo şirketiyle anlaşma yapılırsa:
 *   1. Bu array'e ekle
 *   2. Migration 046 ile DB'ye insert/update
 */
export const CARRIER_FALLBACK: CarrierMeta[] = [
  {
    code: "yurtici",
    displayName: "Yurtiçi Kargo",
    trackingUrlTemplate:
      "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={{TRACKING_NUMBER}}",
  },
];

/** Default carrier (tek seçenek olduğu için her zaman Yurtiçi). */
export const DEFAULT_CARRIER = CARRIER_FALLBACK[0];

/**
 * Carrier code veya free-text display name'den meta bul.
 * Sefa 17 May: tek carrier (yurtici) ile çalışıyoruz — match olmazsa
 * fallback olarak DEFAULT_CARRIER (Yurtiçi Kargo) döner. Eski sistemde
 * fason "MNG" / "Aras" yazmışsa, müşteri tarafı "Yurtiçi" görür.
 * Tarihsel veri için label'ı koruyup template'i null'a düşürürüz.
 */
export function findCarrier(input: string | null | undefined): CarrierMeta {
  if (!input) {
    return DEFAULT_CARRIER;
  }
  const lower = input.toLowerCase().trim();
  const found = CARRIER_FALLBACK.find(
    (c) =>
      c.code === lower ||
      c.displayName.toLowerCase() === lower ||
      // "Yurtiçi" → "yurtici" gibi diakritik tolerans
      stripDiacritics(c.displayName.toLowerCase()) === stripDiacritics(lower)
  );
  if (found) return found;
  // Eski/bilinmeyen carrier — label'ı koru, otomatik link yok
  return {
    code: "yurtici",
    displayName: input,
    trackingUrlTemplate: null,
  };
}

/**
 * Tracking URL üret. URL manuel verildiyse onu döndür (güvenli https
 * doğrulaması zaten /api/fason/update route'unda yapılıyor).
 */
export function getTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
  manualUrl?: string | null
): string | null {
  if (manualUrl && manualUrl.trim().length > 0) {
    return manualUrl;
  }
  if (!trackingNumber || trackingNumber.trim().length === 0) {
    return null;
  }
  const meta = findCarrier(carrier);
  if (!meta.trackingUrlTemplate) return null;
  return meta.trackingUrlTemplate.replace(
    "{{TRACKING_NUMBER}}",
    encodeURIComponent(trackingNumber.trim())
  );
}

/**
 * Locale-aware diakritik temizleme — match için.
 */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
