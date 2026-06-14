import "server-only";

import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { INSTAGRAM_HTTP_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import {
  computeTokenExpiresAt,
  parseInstagramRefreshResponse,
} from "./token-utils";

/**
 * Kısa ömürlü Instagram token → long-lived (≈60 gün).
 * Meta: grant_type=ig_exchange_token
 */
export async function exchangeInstagramLongLivedToken(
  shortLivedToken: string,
  appSecret: string
): Promise<{ accessToken: string; expiresAt: string; expiresIn: number }> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetchWithTimeout(url.toString(), {
    timeoutMs: INSTAGRAM_HTTP_TIMEOUT_MS,
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      typeof body === "object" && body
        ? JSON.stringify(body).slice(0, 240)
        : String(body ?? "");
    throw new Error(`Instagram token exchange ${res.status}: ${detail}`);
  }

  const parsed = parseInstagramRefreshResponse(body);
  if (!parsed) {
    throw new Error("Instagram token exchange: geçersiz yanıt");
  }

  return {
    accessToken: parsed.accessToken,
    expiresAt: computeTokenExpiresAt(parsed.expiresIn),
    expiresIn: parsed.expiresIn,
  };
}

export function maskInstagramToken(token: string): string {
  const t = token.trim();
  if (t.length <= 12) return "••••";
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}
