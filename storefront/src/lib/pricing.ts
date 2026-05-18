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
 * Tahmini teslim tarihi — bugün + üretim süresi + ortalama kargo.
 *
 * Sefa 18 May v68 (NET süreler):
 *   Etiket: 10 iş günü (rulo + tabaka, qty fark etmez)
 *   Sticker: 5 iş günü (die-cut + tabaka)
 *   + Ortalama kargo: 2 iş günü
 *
 * NOT: Resmi tatiller hariç. Bu fonksiyon basit "iş günü" hesabı yapar —
 * weekend (Cmt/Pzr) atlanır, ulusal bayramlar şu an dahil değil (TODO:
 * 2026 resmi tatil takvimi entegrasyonu).
 *
 * @example
 *   deliveryEstimate({ kind: "etiket", qty: 5000 })  // "18 May 2026" (10 + 2 iş günü)
 *   deliveryEstimate({ kind: "sticker", qty: 250 })  // "13 May 2026" (5 + 2 iş günü)
 */
export function deliveryEstimate({ kind, qty }: DeliveryInput): string {
  // qty parametresi geriye uyumluluk için tutuluyor, hesabı etkilemiyor.
  void qty;
  const productionDays = kind === "etiket" ? 10 : 5;
  const shippingDays = 2; // ortalama kargo (İstanbul 1, diğer iller 2-3)
  const totalBusinessDays = productionDays + shippingDays;

  // İş günü hesabı — weekend atlama
  const d = new Date();
  let added = 0;
  while (added < totalBusinessDays) {
    d.setDate(d.getDate() + 1);
    const dayOfWeek = d.getDay(); // 0 = Pzr, 6 = Cmt
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}
