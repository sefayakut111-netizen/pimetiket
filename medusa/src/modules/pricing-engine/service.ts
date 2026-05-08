/**
 * PricingEngineService — formül-bazlı canlı fiyat hesaplama.
 *
 * Medusa'nın native pricing modülü SKU bazlıdır; serbest mm × tier
 * indirimleri için ayrı bir motor gerekiyor. Bu service:
 *   - Etiket: (matPrice + coatPrice + customPrice) × sizeFactor × tierDiscount
 *   - Sticker: tierBase(qty) × matMult × finMult × (size/75)^1.4
 *
 * Storefront /etiket ve /sticker konfigüratörlerindeki canlı fiyat bu
 * servisten gelecek (storefront frontend'inde duplicate var şu an).
 *
 * I adımında: cart.add zamanı bu service çağrılıp line_item.metadata'ya
 * yazılacak.
 */

import {
  LabelPriceInput,
  StickerPriceInput,
  PriceBreakdown,
} from "./types";

// Hardcoded pricing katsayıları (sonra DB'den gelecek — label-config tabloları)
const MAT_PRICE: Record<string, number> = {
  kraft: 1.6,
  beyaz: 1.4,
  ultra: 2.1,
  metalik: 2.6,
};
const COAT_PRICE: Record<string, number> = {
  mat: 0.4,
  parlak: 0.35,
  soft: 0.55,
  yok: 0,
};
const CUSTOM_PRICE: Record<string, number> = {
  yok: 0,
  emboss: 0.6,
  yaldiz: 0.9,
  spotuv: 0.5,
};

const STICKER_BASE: Record<number, number> = {
  50: 7.0,
  100: 5.5,
  250: 4.2,
  500: 3.5,
  1000: 2.9,
  2500: 2.4,
};
const STICKER_MAT: Record<string, number> = {
  vinil: 1,
  transparan: 1.1,
  holo: 1.4,
  kraft: 0.95,
};
const STICKER_FIN: Record<string, number> = {
  parlak: 1,
  mat: 1.05,
  glitter: 1.25,
};

class PricingEngineService {
  // Medusa Module Service base'i bu module'da YOK (data model olmadığı için).
  // Sadece pure compute fonksiyonları.

  computeLabelPrice(input: LabelPriceInput): PriceBreakdown {
    const matP = MAT_PRICE[input.materialCode] ?? 1.5;
    const coatP = COAT_PRICE[input.coatingCode] ?? 0.4;
    const customP = CUSTOM_PRICE[input.customizationCode] ?? 0;
    const sizeFactor = (input.width * input.height) / (60 * 80);
    const baseUnit = (matP + coatP + customP) * sizeFactor;
    const tierDiscount = this.tierDiscountForLabelQty(input.qty);
    const unitPrice = baseUnit * tierDiscount;
    const total = unitPrice * input.qty;

    return {
      unit_price: Number(unitPrice.toFixed(2)),
      total: Math.round(total),
      base_unit: Number(baseUnit.toFixed(2)),
      tier_discount: tierDiscount,
      savings_pct: Math.round((1 - tierDiscount) * 100),
      delivery_estimate: this.estimateDelivery(input.qty),
      upsell: this.upsellForLabelQty(input.qty),
    };
  }

  computeStickerPrice(input: StickerPriceInput): PriceBreakdown {
    const baseUnit = this.stickerTierBase(50, input);
    const currentUnit = this.stickerTierBase(input.tier, input);
    const total = currentUnit * input.tier;

    return {
      unit_price: Number(currentUnit.toFixed(2)),
      total: Math.round(total),
      base_unit: Number(baseUnit.toFixed(2)),
      tier_discount: currentUnit / baseUnit,
      savings_pct: Math.round((1 - currentUnit / baseUnit) * 100),
      delivery_estimate: this.estimateDelivery(input.tier),
    };
  }

  private tierDiscountForLabelQty(qty: number): number {
    if (qty >= 20000) return 0.78;
    if (qty >= 10000) return 0.84;
    if (qty >= 5000) return 0.9;
    if (qty >= 2000) return 0.96;
    return 1;
  }

  private upsellForLabelQty(qty: number) {
    if (qty < 2000)
      return { msg: "+1000 adet ekle, %4 daha tasarruf", next_qty: 2000, extra_savings_pct: 4 };
    if (qty < 5000)
      return { msg: "5000'e çık, %6 daha tasarruf", next_qty: 5000, extra_savings_pct: 6 };
    if (qty < 10000)
      return { msg: "10000'e çık, %6 daha tasarruf", next_qty: 10000, extra_savings_pct: 6 };
    if (qty < 20000)
      return { msg: "20000'e çık, %7 daha tasarruf", next_qty: 20000, extra_savings_pct: 7 };
    return undefined;
  }

  private stickerTierBase(tier: number, input: StickerPriceInput): number {
    const u = STICKER_BASE[tier] ?? 2.4;
    const matMult = STICKER_MAT[input.materialCode] ?? 1;
    const finMult = STICKER_FIN[input.finishCode] ?? 1;
    const sizeMult = Math.pow(input.size / 75, 1.4);
    return u * matMult * finMult * sizeMult;
  }

  private estimateDelivery(qty: number): string {
    const days = qty > 10000 ? 12 : qty > 3000 ? 10 : 8;
    const d = new Date();
    d.setDate(d.getDate() + days);
    const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

export default PricingEngineService;
