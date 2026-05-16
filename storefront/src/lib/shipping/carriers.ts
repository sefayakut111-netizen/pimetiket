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
 * Migration 045'teki seed ile aynı liste. DB unreachable senaryosu için
 * SSR fallback. Aktif source-of-truth: DB tablosu.
 */
export const CARRIER_FALLBACK: CarrierMeta[] = [
  {
    code: "yurtici",
    displayName: "Yurtiçi Kargo",
    trackingUrlTemplate:
      "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={{TRACKING_NUMBER}}",
  },
  {
    code: "aras",
    displayName: "Aras Kargo",
    trackingUrlTemplate:
      "https://kargotakip.araskargo.com.tr/?code={{TRACKING_NUMBER}}",
  },
  {
    code: "mng",
    displayName: "MNG Kargo",
    trackingUrlTemplate:
      "https://service.mngkargo.com.tr/iframe/track.aspx?id={{TRACKING_NUMBER}}",
  },
  {
    code: "ptt",
    displayName: "PTT Kargo",
    trackingUrlTemplate:
      "https://gonderitakip.ptt.gov.tr/Track/Verify?q={{TRACKING_NUMBER}}",
  },
  {
    code: "surat",
    displayName: "Sürat Kargo",
    trackingUrlTemplate:
      "https://www.suratkargo.com.tr/KargoTakip/?kargotakipno={{TRACKING_NUMBER}}",
  },
  {
    code: "hepsijet",
    displayName: "HepsiJet",
    trackingUrlTemplate:
      "https://hepsijet.com/gonderi-takibi?gonderiId={{TRACKING_NUMBER}}",
  },
  {
    code: "ups",
    displayName: "UPS Kargo",
    trackingUrlTemplate: "https://www.ups.com/track?tracknum={{TRACKING_NUMBER}}",
  },
  {
    code: "diger",
    displayName: "Diğer (manuel link)",
    trackingUrlTemplate: null,
  },
];

/**
 * Carrier code veya free-text display name'den meta bul.
 * Fason "Yurtiçi" yazmış, biz "yurtici" code istiyoruz → match.
 */
export function findCarrier(input: string | null | undefined): CarrierMeta {
  if (!input) {
    return {
      code: "diger",
      displayName: "Kargo şirketi",
      trackingUrlTemplate: null,
    };
  }
  const lower = input.toLowerCase().trim();
  const found = CARRIER_FALLBACK.find(
    (c) =>
      c.code === lower ||
      c.displayName.toLowerCase() === lower ||
      // "Yurtiçi" → "yurtici" gibi diakritik tolerans
      stripDiacritics(c.displayName.toLowerCase()) === stripDiacritics(lower)
  );
  return (
    found ?? {
      code: "diger",
      displayName: input,
      trackingUrlTemplate: null,
    }
  );
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
