/**
 * Pim Etiket — pricing helpers (storefront-side).
 *
 * Asıl pricing engine medusa/src/modules/pricing-engine'da; bu modül
 * F+I adımında storefront'tan API çağrısıyla gelir. Şu an mock olarak
 * konfigüratör sayfaları kendi formüllerini kullanıyor.
 *
 * Bu dosya yalnızca paylaşılan delivery date estimate'i sağlar
 * (etiket + sticker konfigüratörlerinde tek source-of-truth).
 */

const MONTHS_TR = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
] as const;

interface DeliveryInput {
  kind: "etiket" | "sticker";
  qty: number;
}

/**
 * Tahmini teslim tarihi — bugün + üretim/kargo süresi.
 *
 * Etiket: 8/10/12 gün (qty bucket'ına göre)
 * Sticker: 5/7/9 gün (genelde daha hızlı, daha küçük iş)
 *
 * @example
 *   deliveryEstimate({ kind: "etiket", qty: 5000 })  // "18 May 2026"
 *   deliveryEstimate({ kind: "sticker", qty: 250 })  // "13 May 2026"
 */
export function deliveryEstimate({ kind, qty }: DeliveryInput): string {
  let days: number;
  if (kind === "etiket") {
    days = qty > 10000 ? 12 : qty > 3000 ? 10 : 8;
  } else {
    days = qty > 1000 ? 9 : qty > 250 ? 7 : 5;
  }

  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}
