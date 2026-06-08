/**
 * Pim bilgi tabanı — site gerçekleri (tek kaynak, admin defaults ile hizalı).
 * Uydurma kargo/teslim/fiyat YOK; değişince burayı güncelle.
 */

/** Kargo anlaşması — site genelinde birincil taşıyıcılar */
export const PIM_CARRIER_NAME = "Yurtiçi Kargo + DHL";

/** Üretimden kargoya verme (iş günü, tasarım onayından sonra; hafta sonu + resmi tatil hariç) */
export const PIM_PRODUCTION_BUSINESS_DAYS = {
  sticker: 3,
  tabaka: 3,
  rulo: 10,
} as const;

/** Yasal satıcı bilgisi (§1 tek kaynak — footer, mesafeli satış, iletişim) */
export const PIM_LEGAL_ENTITY = {
  companyName:
    "SEFA YAKUT ETİKETBOX KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ",
  vkn: "7580606076",
  taxOffice: "Doğanbey Vergi Dairesi",
  address: "Yaşamkent Mah. 3250 Cad. No: 6 A/B Çankaya / Ankara",
  email: "info@pimetiket.com",
  web: "https://pimetiket.com",
} as const;

export function formatProductionLeadTimeSummary(
  locale: "tr" | "en" = "tr"
): string {
  const { sticker, tabaka, rulo } = PIM_PRODUCTION_BUSINESS_DAYS;
  if (locale === "en") {
    return `stickers in ${sticker}, sheet labels in ${tabaka}, roll labels in ${rulo} business days`;
  }
  return `sticker ${sticker}, tabaka etiket ${tabaka}, rulo etiket ${rulo} iş günü içinde kargoda`;
}

export function formatLegalKunyeLine(): string {
  const e = PIM_LEGAL_ENTITY;
  return `${e.companyName} · ${e.address} · VKN: ${e.vkn}`;
}

/** site_settings varsayılanları (admin ayarlar ile aynı) */
export const PIM_SHIPPING_DEFAULTS = {
  feeTry: 49,
  freeThresholdTry: 1000,
} as const;

export const PIM_ORDER_LIMITS = {
  minTotalTry: 250,
  maxTotalTry: 250_000,
} as const;
