/**
 * PayTR iFrame API wrapper — server-only.
 *
 * Akış:
 *   1. createCheckoutToken({ merchantOid, amount, basket, ... }) →
 *      { token, iframeUrl } döner
 *   2. Browser iframeUrl'e yönlenir
 *   3. PayTR success/fail callback POST atar → /api/payment/callback
 *   4. Server hash doğrula (verifyCallbackHash) + "OK" yanıt
 *   5. Refund/iade için refundPayment çağrısı
 *
 * Resmi dokümantasyon: https://dev.paytr.com/iframe-api
 *
 * KRİTİK: Bu modül SADECE server-side import edilir.
 * Browser'a sızdırılırsa MERCHANT_KEY + SALT açıkta kalır.
 */

import "server-only";

import crypto from "node:crypto";
import type {
  PayTrTokenRequest,
  PayTrTokenResponse,
  PayTrCallbackPayload,
  PayTrRefundResponse,
  PayTrBasketItem,
} from "./paytr-types";

// ============================================================
// Config
// ============================================================

interface PayTrConfig {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  testMode: 0 | 1;
}

function getConfig(): PayTrConfig {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error(
      "PayTR env eksik. .env.local'e PAYTR_MERCHANT_ID + PAYTR_MERCHANT_KEY + PAYTR_MERCHANT_SALT ekle."
    );
  }
  // PAYTR_TEST_MODE=1 → sandbox; default 1 (güvenli başlangıç)
  // Production'da explicit 0 set etmeli.
  const testRaw = process.env.PAYTR_TEST_MODE;
  const testMode = testRaw === "0" ? 0 : 1;
  return { merchantId, merchantKey, merchantSalt, testMode };
}

export function isPayTrConfigured(): boolean {
  return Boolean(
    process.env.PAYTR_MERCHANT_ID &&
      process.env.PAYTR_MERCHANT_KEY &&
      process.env.PAYTR_MERCHANT_SALT
  );
}

// ============================================================
// HMAC helpers
// ============================================================

/**
 * PayTR token hash (get-token request için).
 *
 * Format:
 *   hash_str = merchant_id + user_ip + merchant_oid + email +
 *              payment_amount + user_basket + no_installment +
 *              max_installment + currency + test_mode
 *   token = base64(HMAC-SHA256(hash_str + merchant_salt, merchant_key))
 *
 * NOT: salt hash_str'e EKLENİR, key HMAC anahtarıdır.
 */
function computeTokenHash(args: {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: number; // kuruş
  userBasketBase64: string;
  noInstallment: 0 | 1;
  maxInstallment: number;
  currency: string;
  testMode: 0 | 1;
}): string {
  const hashStr =
    args.merchantId +
    args.userIp +
    args.merchantOid +
    args.email +
    String(args.paymentAmount) +
    args.userBasketBase64 +
    String(args.noInstallment) +
    String(args.maxInstallment) +
    args.currency +
    String(args.testMode);

  return crypto
    .createHmac("sha256", args.merchantKey)
    .update(hashStr + args.merchantSalt)
    .digest("base64");
}

/**
 * Callback hash doğrulama.
 *
 * Format:
 *   hash_str = merchant_oid + merchant_salt + status + total_amount
 *   beklenen_hash = base64(HMAC-SHA256(hash_str, merchant_key))
 */
function computeCallbackHash(args: {
  merchantKey: string;
  merchantSalt: string;
  merchantOid: string;
  status: string;
  totalAmount: string;
}): string {
  const hashStr =
    args.merchantOid +
    args.merchantSalt +
    args.status +
    args.totalAmount;

  return crypto
    .createHmac("sha256", args.merchantKey)
    .update(hashStr)
    .digest("base64");
}

/**
 * Refund hash:
 *   hash_str = merchant_id + merchant_oid + return_amount + merchant_salt
 *   token = base64(HMAC-SHA256(hash_str, merchant_key))
 */
function computeRefundHash(args: {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  merchantOid: string;
  returnAmount: number;
}): string {
  const hashStr =
    args.merchantId +
    args.merchantOid +
    String(args.returnAmount) +
    args.merchantSalt;

  return crypto
    .createHmac("sha256", args.merchantKey)
    .update(hashStr)
    .digest("base64");
}

// ============================================================
// Public API
// ============================================================

export interface CreateTokenInput {
  /** Bizim tarafımızda oluşturulan unique sipariş referansı (alfanumerik). */
  merchantOid: string;
  /** Müşteri e-postası */
  email: string;
  /** ₺ cinsinden tutar (örn: 199.99). Otomatik kuruşa çevrilir. */
  amountTL: number;
  basket: PayTrBasketItem[];
  userIp: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  /** Başarılı ödeme sonrası redirect (browser → bu URL) */
  okUrl: string;
  /** Başarısız ödeme sonrası redirect */
  failUrl: string;
  /** Taksit kapalı (1) / açık (0). Default 0 (taksit açık). */
  noInstallment?: 0 | 1;
  /** Max taksit (0 = limitsiz, 1 = peşin). Default 12. */
  maxInstallment?: number;
  /**
   * Currency. Default TL.
   * PayTR API string kodlar bekler: TL / EUR / USD / GBP / RUB.
   * "₺" sembolü GEÇERSİZ → "Geçersiz parametre(ler)" hatası (21 May v68 fix).
   */
  currency?: "TL" | "USD" | "EUR";
  /** Token timeout dakika. Default 30. */
  timeoutLimit?: number;
}

export interface CreateTokenResult {
  ok: true;
  token: string;
  /** Müşterinin yönlendirileceği iframe URL'i */
  iframeUrl: string;
  merchantOid: string;
}

export interface CreateTokenError {
  ok: false;
  reason: string;
  errCode?: number;
}

/**
 * PayTR get-token çağrısı. Browser bu token ile iframe'e yönlendirilir.
 */
export async function createCheckoutToken(
  input: CreateTokenInput
): Promise<CreateTokenResult | CreateTokenError> {
  const cfg = getConfig();

  // Sepeti base64-encoded JSON'a çevir
  const basketBase64 = Buffer.from(JSON.stringify(input.basket)).toString(
    "base64"
  );

  // ₺ → kuruş
  const paymentAmount = Math.round(input.amountTL * 100);

  const noInstallment = input.noInstallment ?? 0;
  const maxInstallment = input.maxInstallment ?? 12;
  // PayTR currency kodu: TL / EUR / USD (sembol DEĞİL — 21 May v68 fix)
  const currency = input.currency ?? "TL";

  // PayTR user_phone: sadece rakam, max 20 char.
  // "+90 555 123 45 67" → "905551234567". Boşluk/parantez/+ kaldır.
  // Aksi halde "Geçersiz parametre(ler)" hatası (21 May v68 fix).
  const cleanPhone = input.userPhone.replace(/\D/g, "").slice(0, 20);

  // PayTR user_name: max 60 char (PayTR docs).
  const cleanName = input.userName.slice(0, 60);

  // PayTR email basit validation — boşsa fallback.
  const cleanEmail = input.email.trim() || "no-reply@pimetiket.com";

  const paytrToken = computeTokenHash({
    merchantId: cfg.merchantId,
    merchantKey: cfg.merchantKey,
    merchantSalt: cfg.merchantSalt,
    userIp: input.userIp,
    merchantOid: input.merchantOid,
    email: cleanEmail,
    paymentAmount,
    userBasketBase64: basketBase64,
    noInstallment,
    maxInstallment,
    currency,
    testMode: cfg.testMode,
  });

  // PayTR x-www-form-urlencoded bekler
  const body: PayTrTokenRequest = {
    merchant_id: cfg.merchantId,
    user_ip: input.userIp,
    merchant_oid: input.merchantOid,
    email: cleanEmail,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: basketBase64,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: cleanName,
    user_address: input.userAddress.slice(0, 400),
    user_phone: cleanPhone,
    merchant_ok_url: input.okUrl,
    merchant_fail_url: input.failUrl,
    timeout_limit: input.timeoutLimit ?? 30,
    currency,
    test_mode: cfg.testMode,
    debug_on: cfg.testMode === 1 ? 1 : 0,
    lang: "tr",
  };

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) params.append(k, String(v));
  }

  let res: Response;
  try {
    res = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "PimEtiket/1.0",
      },
      body: params.toString(),
    });
  } catch (err) {
    console.error("[paytr] get-token network error:", err);
    return { ok: false, reason: "network_error" };
  }

  if (!res.ok) {
    return { ok: false, reason: `http_${res.status}` };
  }

  let data: PayTrTokenResponse;
  try {
    data = (await res.json()) as PayTrTokenResponse;
  } catch (err) {
    console.error("[paytr] get-token JSON parse error:", err);
    return { ok: false, reason: "invalid_json" };
  }

  if (data.status !== "success" || !data.token) {
    console.error("[paytr] get-token failed:", data);
    return {
      ok: false,
      reason: data.reason ?? data.err_msg ?? "unknown_paytr_error",
      errCode: data.err_no,
    };
  }

  return {
    ok: true,
    token: data.token,
    iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
    merchantOid: input.merchantOid,
  };
}

// ============================================================
// Callback verification
// ============================================================

export interface CallbackVerifyResult {
  ok: boolean;
  reason?: string;
  /** Doğrulanmış payload (ok=true ise) */
  data?: PayTrCallbackPayload;
}

/**
 * Callback POST body'sini doğrula.
 *
 * @param formData PayTR'den gelen form data (her field string)
 * @returns ok=true ise hash valid, processable
 */
export function verifyCallback(
  formData: Record<string, string>
): CallbackVerifyResult {
  const cfg = getConfig();

  const merchantOid = formData.merchant_oid;
  const status = formData.status;
  const totalAmount = formData.total_amount;
  const incomingHash = formData.hash;

  if (!merchantOid || !status || !totalAmount || !incomingHash) {
    return { ok: false, reason: "missing_required_fields" };
  }

  if (status !== "success" && status !== "failed") {
    return { ok: false, reason: `unknown_status_${status}` };
  }

  const expectedHash = computeCallbackHash({
    merchantKey: cfg.merchantKey,
    merchantSalt: cfg.merchantSalt,
    merchantOid,
    status,
    totalAmount,
  });

  if (incomingHash !== expectedHash) {
    return { ok: false, reason: "hash_mismatch" };
  }

  return {
    ok: true,
    data: {
      merchant_oid: merchantOid,
      status: status as "success" | "failed",
      total_amount: totalAmount,
      hash: incomingHash,
      failed_reason_code: formData.failed_reason_code,
      failed_reason_msg: formData.failed_reason_msg,
      installment_count: formData.installment_count,
      payment_type: formData.payment_type,
      test_mode: formData.test_mode,
      currency: formData.currency,
      payment_amount: formData.payment_amount,
      hash_params: formData.hash_params,
      card_pan: formData.card_pan,
    },
  };
}

// ============================================================
// Refund
// ============================================================

export interface RefundInput {
  merchantOid: string;
  /** İade tutarı ₺ (kısmi iade için < total). */
  returnAmountTL: number;
}

export interface RefundResult {
  ok: boolean;
  reason?: string;
  errCode?: number;
}

export async function refundPayment(
  input: RefundInput
): Promise<RefundResult> {
  const cfg = getConfig();
  const returnAmount = Math.round(input.returnAmountTL * 100); // kuruş

  const paytrToken = computeRefundHash({
    merchantId: cfg.merchantId,
    merchantKey: cfg.merchantKey,
    merchantSalt: cfg.merchantSalt,
    merchantOid: input.merchantOid,
    returnAmount,
  });

  const params = new URLSearchParams({
    merchant_id: cfg.merchantId,
    merchant_oid: input.merchantOid,
    return_amount: String(returnAmount),
    paytr_token: paytrToken,
  });

  let res: Response;
  try {
    res = await fetch("https://www.paytr.com/odeme/iade", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "PimEtiket/1.0",
      },
      body: params.toString(),
    });
  } catch (err) {
    console.error("[paytr] refund network error:", err);
    return { ok: false, reason: "network_error" };
  }

  if (!res.ok) {
    return { ok: false, reason: `http_${res.status}` };
  }

  let data: PayTrRefundResponse;
  try {
    data = (await res.json()) as PayTrRefundResponse;
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (data.status !== "success") {
    return {
      ok: false,
      reason: data.reason ?? data.err_msg ?? "refund_failed",
      errCode: data.err_no,
    };
  }

  return { ok: true };
}

// ============================================================
// queryPaymentStatus — PayTR Durum Sorgu API
// Sefa 20 May v68 (Agent denetim P0 #1 — reconciler için)
//
// IPN miss durumunda: ödemenin gerçekten başarılı olup olmadığını
// PayTR'den senkron sorgu ile doğrular. Müşteri tarayıcısı kapanmış
// veya webhook ulaşmamış olabilir → bu API ile recover edilir.
//
// Endpoint: https://www.paytr.com/odeme/durum-sorgu
// Hash: sha256(merchant_id + merchant_oid + merchant_salt + merchant_key) base64
// ============================================================

interface QueryStatusResult {
  ok: boolean;
  status?: "success" | "waiting" | "failed";
  paymentAmountKurus?: number;
  paymentTotalKurus?: number;
  installmentCount?: number;
  reason?: string;
  errCode?: number;
}

function computeQueryHash(params: {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  merchantOid: string;
}): string {
  const raw =
    params.merchantId + params.merchantOid + params.merchantSalt;
  return crypto
    .createHmac("sha256", params.merchantKey)
    .update(raw)
    .digest("base64");
}

export async function queryPaymentStatus(
  merchantOid: string
): Promise<QueryStatusResult> {
  const cfg = getConfig();
  const paytrToken = computeQueryHash({
    merchantId: cfg.merchantId,
    merchantKey: cfg.merchantKey,
    merchantSalt: cfg.merchantSalt,
    merchantOid,
  });

  const params = new URLSearchParams({
    merchant_id: cfg.merchantId,
    merchant_oid: merchantOid,
    paytr_token: paytrToken,
  });

  let res: Response;
  try {
    res = await fetch("https://www.paytr.com/odeme/durum-sorgu", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "PimEtiket/1.0",
      },
      body: params.toString(),
    });
  } catch (err) {
    console.error("[paytr/query] network error:", merchantOid, err);
    return { ok: false, reason: "network_error" };
  }

  if (!res.ok) {
    return { ok: false, reason: `http_${res.status}` };
  }

  let data: {
    status: string;
    payment_amount?: string | number;
    payment_total?: string | number;
    installment_count?: string | number;
    reason?: string;
    err_msg?: string;
    err_no?: number;
  };
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  // status: 'success' | 'waiting' | 'failed'
  if (data.status === "success") {
    return {
      ok: true,
      status: "success",
      paymentAmountKurus: Number(data.payment_amount ?? 0),
      paymentTotalKurus: Number(data.payment_total ?? 0),
      installmentCount: Number(data.installment_count ?? 1),
    };
  }
  if (data.status === "waiting") {
    return { ok: true, status: "waiting" };
  }
  if (data.status === "failed") {
    return {
      ok: true,
      status: "failed",
      reason: data.reason ?? data.err_msg ?? "failed",
      errCode: data.err_no,
    };
  }
  return {
    ok: false,
    reason: `unknown_status:${data.status}`,
  };
}

// ============================================================
// Helper — sepet item builder (cart_items'tan PayTR formatına)
// ============================================================

export function buildBasket(
  items: Array<{ title: string; total: number; qty: number }>
): PayTrBasketItem[] {
  // PayTR fiyat formatı: "199.99" string ₺.kuruş
  // total = qty × unit, ama PayTR sepet item'ında **birim fiyat × qty**
  // toplamı total ile uyumlu olmalı. Biz total'ı qty 1 ile geçiyoruz
  // (basit yaklaşım — qty bilgisi item başlığında zaten var).
  return items.map((i) => [
    i.title.slice(0, 64), // PayTR title max 64 char
    i.total.toFixed(2),
    1,
  ]);
}
