/**
 * iyzico Checkout Form wrapper — server-side only.
 *
 * Akış:
 *   1. createCheckoutForm() → token + paymentPageUrl döner.
 *      Müşteri bu URL'e yönlendirilir; iyzico iframe'inde 3DS yapar.
 *   2. iyzico, callbackUrl'e POST atar (status=success ile).
 *   3. retrieveCheckoutForm(token) → ödeme detayı (paymentId, kart son4, vs).
 *   4. fn_create_order RPC ile sipariş açılır + payments INSERT.
 *
 * SDK CommonJS — `iyzipay` paketi callback-based. Burada Promise wrap.
 *
 * KRİTİK: bu modül SADECE server-side import edilmelidir
 * (route handler / Server Action / Edge fn). Browser'a sızarsa secret
 * leak.
 */

import "server-only";

import Iyzipay from "iyzipay";
import type {
  IyzicoInitializeParams,
  IyzicoInitializeResult,
  IyzicoRetrieveParams,
  IyzicoRetrieveResult,
  IyzicoRefundParams,
  IyzicoRefundResult,
  IyzicoCancelParams,
  IyzicoCancelResult,
  IyzipayInstance,
  IyzipayConfig,
} from "./iyzico-types";

// ============================================================
// Singleton
// ============================================================

let _client: IyzipayInstance | null = null;

function getClient(): IyzipayInstance {
  if (_client) return _client;

  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  const uri =
    process.env.IYZICO_BASE_URL ?? "https://sandbox-api.iyzipay.com";

  if (!apiKey || !secretKey) {
    throw new Error(
      "iyzico env eksik. .env.local'e IYZICO_API_KEY + IYZICO_SECRET_KEY ekle."
    );
  }

  const config: IyzipayConfig = { apiKey, secretKey, uri };

  // iyzipay tipi yok, runtime constructor — type cast
  _client = new (Iyzipay as unknown as new (
    cfg: IyzipayConfig
  ) => IyzipayInstance)(config);
  return _client;
}

export function isIyzicoConfigured(): boolean {
  return Boolean(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY);
}

// ============================================================
// Promise wrappers
// ============================================================

export function createCheckoutForm(
  params: IyzicoInitializeParams
): Promise<IyzicoInitializeResult> {
  const client = getClient();
  return new Promise((resolve, reject) => {
    client.checkoutFormInitialize.create(params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

export function retrieveCheckoutForm(
  params: IyzicoRetrieveParams
): Promise<IyzicoRetrieveResult> {
  const client = getClient();
  return new Promise((resolve, reject) => {
    client.checkoutForm.retrieve(params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

export function refundPayment(
  params: IyzicoRefundParams
): Promise<IyzicoRefundResult> {
  const client = getClient();
  return new Promise((resolve, reject) => {
    client.refund.create(params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

export function cancelPayment(
  params: IyzicoCancelParams
): Promise<IyzicoCancelResult> {
  const client = getClient();
  return new Promise((resolve, reject) => {
    client.cancel.create(params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

// ============================================================
// Helpers
// ============================================================

/** Sayıyı iyzico format string'e çevir ("199.99") */
export function fmtPrice(amount: number): string {
  return amount.toFixed(2);
}

/** Sepet toplamı = items[].price toplamı + KDV. Sapma <0.01 olmalı. */
export function validateBasketTotals(
  items: Array<{ price: string }>,
  paidPrice: string
): boolean {
  const sum = items.reduce((acc, it) => acc + parseFloat(it.price), 0);
  const paid = parseFloat(paidPrice);
  return Math.abs(sum - paid) < 0.01;
}

/** TR'de TC kimlik 11 hane gereklidir. Kurumsal için "11111111111" gönderilebilir. */
export const CORPORATE_PLACEHOLDER_TC = "11111111111";
