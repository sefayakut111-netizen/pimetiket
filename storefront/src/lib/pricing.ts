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

import { addBusinessDays } from "./turkey-holidays";
import { productionDaysFor, type DeliveryFormFactor } from "./delivery-promise";

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
  /** Etiket için form factor — üretim süresi tabaka(5) vs rulo(10) ayrımı.
   *  sticker'da yok sayılır. Verilmezse etiket güvenli üst sınır (rulo=10). */
  formFactor?: DeliveryFormFactor;
}

/**
 * Tahmini teslim tarihi — bugün + üretim süresi + ortalama kargo.
 *
 * Üretim süreleri KANONİK kaynaktan gelir (site-facts.ts →
 * PIM_PRODUCTION_BUSINESS_DAYS, delivery-promise.ts üzerinden):
 *   Sticker: 3 iş günü
 *   Tabaka etiket: 5 iş günü · Rulo etiket: 10 iş günü
 *   (etiket formFactor verilmezse güvenli üst sınır 10)
 *   + Ortalama kargo: 2 iş günü
 *
 * NOT: Resmi tatiller HARİÇ (Sefa 18 May Faz 3 entegre etti).
 * turkey-holidays.ts 2026-2027 TR resmi tatil listesini içerir.
 * Weekend (Cmt/Pzr) + ulusal bayram + Ramazan + Kurban günleri atlanır.
 *
 * @example
 *   deliveryEstimate({ kind: "etiket", qty: 5000, formFactor: "tabaka" })  // 5 + 2 iş günü
 *   deliveryEstimate({ kind: "etiket", qty: 5000, formFactor: "rulo" })    // 10 + 2 iş günü
 *   deliveryEstimate({ kind: "sticker", qty: 250 })                        // 3 + 2 iş günü
 */
export function deliveryEstimate({ kind, qty, formFactor }: DeliveryInput): string {
  // qty parametresi geriye uyumluluk için tutuluyor, hesabı etkilemiyor.
  void qty;
  const productionDays = productionDaysFor(kind, formFactor);
  const shippingDays = 2; // ortalama kargo (İstanbul 1, diğer iller 2-3)
  const totalBusinessDays = productionDays + shippingDays;

  // Sefa 21 May v68 (ürün denetim P1 #10): "today" bugünün başlangıcı —
  // saat bilgisi addBusinessDays içinde gün geçişi anlarında tarih atlamasına
  // sebep oluyordu (aynı tür sticker'da bir varyant 3 Haz, biri 4 Haz). Saat
  // sıfırlanarak hesaplandı → aynı gün açılan tüm varyantlar aynı tarihi gösterir.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = addBusinessDays(today, totalBusinessDays);
  return `${target.getDate()} ${MONTHS_TR[target.getMonth()]} ${target.getFullYear()}`;
}
