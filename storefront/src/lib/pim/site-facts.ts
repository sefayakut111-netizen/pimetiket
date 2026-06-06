/**
 * Pim bilgi tabanı — site gerçekleri (tek kaynak, admin defaults ile hizalı).
 * Uydurma kargo/teslim/fiyat YOK; değişince burayı güncelle.
 */

/** Kargo anlaşması — site genelinde tek firma */
export const PIM_CARRIER_NAME = "Yurtiçi Kargo";

/** Üretimden kargoya verme (iş günü, hafta sonu + resmi tatil hariç) */
export const PIM_PRODUCTION_BUSINESS_DAYS = {
  etiket: 10,
  sticker: 5,
} as const;

/** site_settings varsayılanları (admin ayarlar ile aynı) */
export const PIM_SHIPPING_DEFAULTS = {
  feeTry: 49,
  freeThresholdTry: 500,
} as const;

export const PIM_ORDER_LIMITS = {
  minTotalTry: 250,
  maxTotalTry: 250_000,
} as const;
