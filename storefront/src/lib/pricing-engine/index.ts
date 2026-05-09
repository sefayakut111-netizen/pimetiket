/**
 * Pricing engine — saf fonksiyon public API.
 *
 * Bu modülün tamamı side-effect'siz, DB'siz, I/O'suz. Test edilebilir,
 * server'da Medusa service tarafından çağrılır, client'ta storefront
 * preview için kullanılır (ama satın alma fiyatı SADECE server'dan gelir).
 *
 * Üst seviye akış:
 *   1. computeGeometry({W, H, cut, qty}) → tabaka + rulo plan
 *   2. computeCost({geometry, requestedQty, production, operation, margin, tier}) → fiyat
 *   3. computeCart(lineItems[]) → sepet grup indirimi
 */

export * from "./constants";
export * from "./geometry";
export * from "./cost";
export * from "./cart-discount";

import { computeGeometry, type CutType, type GeometryResult } from "./geometry";
import {
  computeCost,
  findTier,
  type CostInput,
  type CostResult,
  type ProductionRates,
  type OperationRates,
  type MarginConfig,
} from "./cost";

// ============================================================
// Üst seviye yardımcı: tek çağrıda quote
// ============================================================

export interface QuoteInput {
  width: number;
  height: number;
  cut: CutType;
  qty: number;
  production: ProductionRates;
  operation: OperationRates;
  margin: MarginConfig;
}

export type QuoteResult =
  | { ok: true; geometry: GeometryResult; cost: CostResult }
  | { ok: false; reason: string; bigEtiketRedirect?: boolean };

/**
 * Geometri + cost'u tek çağrıda hesaplar. Service layer'ın ana helper'ı.
 *
 * Validate + büyük etiket redirect mesajları burada üretilir.
 */
export function quoteSticker(input: QuoteInput): QuoteResult {
  const { width: W, height: H, qty: Q } = input;

  if (W < 5 || H < 5 || Q < 1) {
    return { ok: false, reason: "Geçerli boyut ve adet gir" };
  }

  // Çok büyük sticker — büyük etiket servisine yönlendir
  const BIG_W = 400;
  const BIG_H = 650;
  if (W > BIG_W || H > BIG_H) {
    return {
      ok: false,
      reason:
        "Bu boyut sticker servisinin sınırlarını aşıyor (max 40×65 cm). Büyük etiket servisi yakında açılacak.",
      bigEtiketRedirect: true,
    };
  }

  const geometry = computeGeometry({
    width: W,
    height: H,
    cut: input.cut,
    qty: Q,
  });

  if (!geometry) {
    return {
      ok: false,
      reason:
        "Bu boyut için uygun tabaka düzeni bulunamadı. Daha küçük bir boyut dene.",
    };
  }

  const tier = findTier(Q);
  const cost = computeCost({
    geometry,
    requestedQty: Q,
    production: input.production,
    operation: input.operation,
    margin: input.margin,
    tier,
  });

  return { ok: true, geometry, cost };
}

// Re-export commonly used types
export type {
  CostInput,
  CostResult,
  CutType,
  GeometryResult,
  MarginConfig,
  OperationRates,
  ProductionRates,
};
