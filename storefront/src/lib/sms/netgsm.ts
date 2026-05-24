/**
 * Netgsm SMS gönderim wrapper — server-only.
 *
 * Netgsm REST API: https://www.netgsm.com.tr/dokuman/
 *
 * .env:
 *   NETGSM_USERCODE=<musteri_no>
 *   NETGSM_PASSWORD=<api_sifresi>
 *   NETGSM_HEADER=PIMETIKET   # onaylı başlık
 *
 * Tek mesaj endpoint:
 *   POST https://api.netgsm.com.tr/sms/rest/v2/send
 *   {
 *     "msgheader": "PIMETIKET",
 *     "messages": [{ "msg": "...", "no": "5XX..." }],
 *     "encoding": "TR",
 *     "iysfilter": "11",
 *     "partnercode": ""
 *   }
 *
 * Ticari SMS için IYS (İleti Yönetim Sistemi) izni gerekir;
 * transactional SMS için exempt (sipariş bildirimleri).
 */

import "server-only";

import {
  fetchWithTimeout,
  isFetchTimeoutError,
} from "@/lib/http/fetch-with-timeout";
import { NETGSM_HTTP_TIMEOUT_MS } from "@/lib/http/external-timeouts";

interface NetgsmConfig {
  userCode: string;
  password: string;
  header: string;
}

function getConfig(): NetgsmConfig | null {
  const userCode = process.env.NETGSM_USERCODE;
  const password = process.env.NETGSM_PASSWORD;
  const header = process.env.NETGSM_HEADER;
  if (!userCode || !password || !header) return null;
  return { userCode, password, header };
}

export function isSmsConfigured(): boolean {
  return getConfig() !== null;
}

const NETGSM_BASE = "https://api.netgsm.com.tr";

interface NetgsmSendResponse {
  jobid?: string;
  code?: string;
  description?: string;
}

/**
 * Tek mesaj gönder. Telefon "5XXXXXXXXX" formatında olmalı (10 hane,
 * başında 0 yok, +90 yok).
 */
export async function sendSms(args: {
  to: string;
  message: string;
  /** Transactional mı (IYS exempt)? Varsayılan: true (sipariş/prova/kargo) */
  transactional?: boolean;
}): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const cfg = getConfig();
  if (!cfg) {
    console.warn("[sms] Netgsm env eksik, SMS gönderilmedi:", args.message);
    return { ok: false, error: "not_configured" };
  }

  // Telefon normalize
  const phone = args.to.replace(/\D/g, "");
  let normalized = phone;
  if (normalized.startsWith("90")) normalized = normalized.slice(2);
  if (normalized.startsWith("0")) normalized = normalized.slice(1);
  if (normalized.length !== 10 || !normalized.startsWith("5")) {
    return { ok: false, error: "invalid_phone" };
  }

  const body = {
    msgheader: cfg.header,
    messages: [{ msg: args.message, no: normalized }],
    encoding: "TR",
    // 11 = ticari, 0 = transactional. Default transactional.
    iysfilter: args.transactional === false ? "11" : "0",
    partnercode: "",
  };

  try {
    const auth = Buffer.from(`${cfg.userCode}:${cfg.password}`).toString(
      "base64"
    );
    const res = await fetchWithTimeout(`${NETGSM_BASE}/sms/rest/v2/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
      timeoutMs: NETGSM_HTTP_TIMEOUT_MS,
    });
    const data = (await res.json()) as NetgsmSendResponse;
    if (data.code === "0" || data.code === "00") {
      return { ok: true, jobId: data.jobid };
    }
    return {
      ok: false,
      error: data.description ?? `code_${data.code ?? "unknown"}`,
    };
  } catch (err) {
    console.error("[sms] Netgsm error:", err);
    return {
      ok: false,
      error: isFetchTimeoutError(err) ? "timeout" : "request_failed",
    };
  }
}

// ============================================================
// Helpers (sipariş bildirimleri için kısa mesajlar)
// ============================================================

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

export async function sendOrderConfirmationSms(args: {
  phone: string;
  orderId: string;
  total: number;
}) {
  return sendSms({
    to: args.phone,
    message: `Pim Etiket: Siparisin alindi! ${args.orderId} - ${Math.round(
      args.total
    ).toLocaleString("en-US")} ₺. Detay: ${SITE}/siparis/${args.orderId}`,
    transactional: true,
  });
}

export async function sendProofReadySms(args: {
  phone: string;
  orderId: string;
}) {
  return sendSms({
    to: args.phone,
    message: `Pim Etiket: Provan hazir! ${args.orderId} - inceleyip onaylar misin? ${SITE}/siparis/${args.orderId}`,
    transactional: true,
  });
}

export async function sendShippingSms(args: {
  phone: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
}) {
  return sendSms({
    to: args.phone,
    message: `Pim Etiket: Siparisin yola cikti. ${args.carrier} ${args.trackingNumber}. Detay: ${SITE}/siparis/${args.orderId}`,
    transactional: true,
  });
}
