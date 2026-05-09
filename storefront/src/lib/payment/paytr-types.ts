/**
 * PayTR API tipleri — PayTR iFrame API + Refund.
 *
 * Resmi dokümantasyon: https://dev.paytr.com/iframe-api
 *
 * Akış:
 *   1. /api/payment/init → POST get-token → token + iframe URL
 *   2. Browser → iframe URL → kart formu PayTR'de
 *   3. PayTR success/fail callback POST eder → /api/payment/callback
 *   4. Server hash doğrula → "OK" yanıt → fn_create_order + redirect
 */

// ============================================================
// get-token request
// ============================================================

export interface PayTrTokenRequest {
  /** Mağaza ID — sayısal */
  merchant_id: string;
  /** Müşteri IPv4 */
  user_ip: string;
  /** Sipariş referansı — alfanumerik, max 64 char, idempotent */
  merchant_oid: string;
  /** Müşteri e-posta */
  email: string;
  /** Tutar kuruş cinsinden (199.99 TL → 19999) */
  payment_amount: number;
  /** HMAC-SHA256 base64 token */
  paytr_token: string;
  /** Sepet base64 JSON: [["Ürün adı", "fiyat (TL.kuruş string)", adet], ...] */
  user_basket: string;
  /** Taksit izin verilmiyor: 1, izin: 0 */
  no_installment: 0 | 1;
  /** Max taksit: 0 = limitsiz, 1-12 = belirli */
  max_installment: number;
  user_name: string;
  user_address: string;
  user_phone: string;
  /** Başarılı dönüş URL'i */
  merchant_ok_url: string;
  /** Başarısız dönüş URL'i */
  merchant_fail_url: string;
  /** Token timeout dk (default 30) */
  timeout_limit?: number;
  /** TL veya USD/EUR */
  currency: "TL" | "USD" | "EUR" | "GBP" | "RUB";
  /** Test mode: 1 (sandbox), 0 (production) */
  test_mode: 0 | 1;
  /** Debug mode (0/1) */
  debug_on?: 0 | 1;
  /** Dil: tr / en */
  lang?: "tr" | "en";
  /** Non-3DS test (0/1) */
  non_3d?: 0 | 1;
}

export interface PayTrTokenResponse {
  /** "success" | "failed" */
  status: "success" | "failed";
  /** Token (success'te) */
  token?: string;
  /** Hata mesajı (failed'te) */
  reason?: string;
  /** Hata kodu (failed'te) */
  err_no?: number;
  err_msg?: string;
}

// ============================================================
// Callback POST body (PayTR → bizim sunucumuz)
// ============================================================

export interface PayTrCallbackPayload {
  merchant_oid: string;
  status: "success" | "failed";
  /** Tahsil edilen toplam (kuruş) */
  total_amount: string;
  /** HMAC-SHA256 base64 hash — doğrulama için */
  hash: string;
  /** failed'te dolu olur */
  failed_reason_code?: string;
  failed_reason_msg?: string;
  /** taksit (success'te) */
  installment_count?: string;
  payment_type?: string;
  /** kart son 4 hane */
  test_mode?: string;
  /** Para birimi */
  currency?: string;
  /** Yeni alanlar (PayTR güncellemeleriyle gelir) */
  payment_amount?: string;
  hash_params?: string;
  card_pan?: string;
}

// ============================================================
// Refund request
// ============================================================

export interface PayTrRefundRequest {
  merchant_id: string;
  merchant_oid: string;
  /** İade tutarı kuruş (kısmi iade için < total) */
  return_amount: number;
  /** HMAC token */
  paytr_token: string;
}

export interface PayTrRefundResponse {
  status: "success" | "failed";
  err_no?: number;
  err_msg?: string;
  reason?: string;
}

// ============================================================
// Sepet item — PayTR formatı
// ============================================================

/**
 * PayTR sepet formatı: [name, "price.kurus" string, quantity]
 * Örn: ["Sticker · Vinil + Parlak", "199.99", 1]
 */
export type PayTrBasketItem = [string, string, number];
