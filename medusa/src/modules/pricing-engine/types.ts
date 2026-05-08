/**
 * Pricing engine type definitions.
 */

export interface LabelPriceInput {
  materialCode: string; // "kraft", "beyaz", "ultra", "metalik"
  coatingCode: string; // "mat", "parlak", "soft", "yok"
  customizationCode: string; // "yok", "emboss", "yaldiz", "spotuv"
  yaldizColor?: string; // sadece customization === "yaldiz" iken
  windingNumber: number; // 1-8
  width: number; // mm
  height: number; // mm
  qty: number; // adet (1000-50000, 1000'er artar)
}

export interface StickerPriceInput {
  shape: "circle" | "square" | "rounded" | "die";
  materialCode: string; // "vinil", "transparan", "holo", "kraft"
  finishCode: string; // "parlak", "mat", "glitter"
  size: number; // mm (50/75/100/150)
  tier: number; // 50/100/250/500/1000/2500
}

export interface PriceBreakdown {
  unit_price: number; // birim fiyat (TL/adet, 2 ondalık)
  total: number; // toplam (TL, integer)
  base_unit: number; // indirimsiz birim
  tier_discount: number; // 0-1 arası multiplier (1 = indirim yok)
  savings_pct: number; // 0-100 arası %
  delivery_estimate: string; // "22 May 2026" gibi
  upsell?: {
    msg: string;
    next_qty: number;
    extra_savings_pct: number;
  };
}
