/**
 * Unsubscribe token sistemi — server-only.
 *
 * Sefa 21 May v68 — Resend tamamlama paketi.
 *
 * HMAC-imzalı stateless token:
 *   payload = `${emailB64url}.${category}.${exp_ts}`
 *   token = `${payload}.${hmacB64url(payload)}`
 *
 * Avantaj:
 *   - DB lookup yok (verify O(1))
 *   - Exp ile süreli olabilir
 *   - Secret rotate olursa eski linkler kendiliğinden invalidate
 *
 * KVKK Notu:
 *   Tek tıkla unsubscribe (RFC 8058) Gmail/Yahoo'nun yeni zorunluluğu.
 *   POST endpoint'ine "List-Unsubscribe-Post: List-Unsubscribe=One-Click"
 *   header'ı eklenerek desteklenir. Bu modül o akışa hizmet eder.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

// Yıl bazlı default expiry — link uzun ömürlü olsun
const DEFAULT_EXPIRY_DAYS = 365;

export type UnsubscribeCategory =
  | "marketing"
  | "blog"
  | "lead"
  | "all";

function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "UNSUBSCRIBE_SECRET eksik veya çok kısa (>=16 char). " +
        ".env'e ekle."
    );
  }
  return s;
}

function b64urlEncode(s: string | Buffer): string {
  return Buffer.from(typeof s === "string" ? s : s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecodeStr(s: string): string {
  return Buffer.from(
    s.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (s.length % 4)) % 4),
    "base64"
  ).toString("utf8");
}

function hmac(payload: string): string {
  return b64urlEncode(
    createHmac("sha256", getSecret()).update(payload).digest()
  );
}

export interface UnsubscribeTokenPayload {
  email: string;
  category: UnsubscribeCategory;
  exp: number; // Unix seconds
}

/** HMAC-imzalı token üret. */
export function createUnsubscribeToken(
  email: string,
  category: UnsubscribeCategory,
  expiryDays: number = DEFAULT_EXPIRY_DAYS
): string {
  const exp = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;
  const emailB64 = b64urlEncode(email.toLowerCase().trim());
  const payload = `${emailB64}.${category}.${exp}`;
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

/** Token doğrula + payload çıkar. */
export function verifyUnsubscribeToken(
  token: string
): UnsubscribeTokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [emailB64, category, expStr, sig] = parts;
  const payload = `${emailB64}.${category}.${expStr}`;

  // HMAC verify (timing-safe)
  let expected: string;
  try {
    expected = hmac(payload);
  } catch {
    return null;
  }
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  // Expiry check
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  // Category validate
  const validCats: UnsubscribeCategory[] = [
    "marketing",
    "blog",
    "lead",
    "all",
  ];
  if (!validCats.includes(category as UnsubscribeCategory)) {
    return null;
  }

  let email: string;
  try {
    email = b64urlDecodeStr(emailB64);
  } catch {
    return null;
  }
  if (!email || !email.includes("@")) return null;

  return { email, category: category as UnsubscribeCategory, exp };
}

/** Frontend için tam URL — mail içine basılacak. */
export function buildUnsubscribeUrl(
  email: string,
  category: UnsubscribeCategory
): string {
  const token = createUnsubscribeToken(email, category);
  return `${SITE_URL}/bildirim-tercihleri/cikis?t=${encodeURIComponent(token)}`;
}

/** Resend gönderim için List-Unsubscribe header değeri (RFC 2369). */
export function buildListUnsubscribeHeader(
  email: string,
  category: UnsubscribeCategory
): { listUnsubscribe: string; listUnsubscribePost: string } {
  const url = buildUnsubscribeUrl(email, category);
  // mailto fallback — bazı mail client'lar mailto'yu tercih eder
  const mailto = `mailto:unsubscribe@pimetiket.com?subject=${encodeURIComponent(
    "Unsubscribe " + email
  )}`;
  return {
    listUnsubscribe: `<${url}>, <${mailto}>`,
    // RFC 8058 — Gmail/Yahoo One-Click unsubscribe
    listUnsubscribePost: "List-Unsubscribe=One-Click",
  };
}
