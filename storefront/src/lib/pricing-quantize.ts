/**
 * Cart-Quantized Pricing — fiyat tutarsızlığını çözen tek-doğru-kaynak.
 *
 * Sorun (Sefa 20 May v68 test): Konfigüratörde gösterilen fiyat sepete
 * eklenince farklı görünüyordu (1-2 ₺ yuvarlama farkı).
 *
 *   - Konfigüratör: total = perDesignTotal × designCount × discount  (raw)
 *                   PriceCard: Math.round(364.38 × 3) = 1093
 *
 *   - Sepete kayıt: total = Math.round(rawTotal) = 1093, unit = 3.6438→3.64
 *                   Sepette gösterilen: "3,64 ₺ × 300 adet = 1.092 ₺"
 *                                       (helper hint), Toplam: "1.093 ₺"
 *                   → 1 ₺ fark, kullanıcı kafası karışır
 *
 * Çözüm: Kart-tutarlı hesap. Birim fiyat 2 ondalık quantize, total linear
 * `unit × qty`. Konfigüratör de aynı formülü kullanır → her yerde aynı rakam.
 *
 * Kullanım:
 *   const { unit, total } = quantizeForCart(rawUnitPrice, totalQty);
 *   // PriceCard'a total ver
 *   // addToCustomerCart'a {unit, total, qty: totalQty}
 *   // Sepette unit × qty = total her zaman
 */

export interface QuantizedPrice {
  /** 2 ondalık birim fiyat (örn. 3.64) */
  unit: number;
  /** Tam sayı toplam — Math.round(unit × qty) (örn. 1092) */
  total: number;
}

/**
 * Ham birim fiyatı 2 ondalık'a quantize eder ve toplam fiyatı linear hesaplar.
 * Sepetteki `item.unit × item.qty` ile %100 tutarlı sonuç döner.
 */
export function quantizeForCart(
  rawUnitPrice: number,
  totalQty: number
): QuantizedPrice {
  if (!Number.isFinite(rawUnitPrice) || !Number.isFinite(totalQty)) {
    return { unit: 0, total: 0 };
  }
  // 2 ondalık quantize — Banker's rounding değil, std round
  const unit = Math.round(rawUnitPrice * 100) / 100;
  const total = Math.round(unit * totalQty);
  return { unit, total };
}
