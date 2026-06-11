import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  INSTAGRAM_ACCESS_TOKEN_KEY,
  type InstagramTokenStatus,
  computeTokenExpiresAt,
  daysUntilIso,
  parseInstagramRefreshResponse,
  resolveInstagramTokenPriority,
} from "./token-utils";

export {
  INSTAGRAM_ACCESS_TOKEN_KEY,
  type InstagramTokenSource,
  type InstagramTokenStatus,
  computeTokenExpiresAt,
  daysUntilIso,
  parseInstagramRefreshResponse,
  resolveInstagramTokenPriority,
} from "./token-utils";

export async function getInstagramToken(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integration_secrets")
    .select("value")
    .eq("key", INSTAGRAM_ACCESS_TOKEN_KEY)
    .maybeSingle();

  const dbValue = (data as { value?: string } | null)?.value;
  const resolved = resolveInstagramTokenPriority(
    dbValue,
    process.env.INSTAGRAM_ACCESS_TOKEN
  );
  return resolved.token;
}

export async function getInstagramTokenStatus(): Promise<InstagramTokenStatus> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integration_secrets")
    .select("value, expires_at, updated_at")
    .eq("key", INSTAGRAM_ACCESS_TOKEN_KEY)
    .maybeSingle();

  const row = data as {
    value?: string;
    expires_at?: string | null;
    updated_at?: string | null;
  } | null;

  const dbValue = row?.value?.trim();
  if (dbValue) {
    const expiresAt = row?.expires_at ?? null;
    return {
      source: "db",
      hasToken: true,
      updatedAt: row?.updated_at ?? null,
      expiresAt,
      daysRemaining: daysUntilIso(expiresAt),
    };
  }

  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (envToken) {
    return {
      source: "env",
      hasToken: true,
      updatedAt: null,
      expiresAt: null,
      daysRemaining: null,
    };
  }

  return {
    source: "none",
    hasToken: false,
    updatedAt: null,
    expiresAt: null,
    daysRemaining: null,
  };
}

export async function saveInstagramAccessToken(
  accessToken: string,
  expiresAt: string | null
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("integration_secrets").upsert(
    {
      key: INSTAGRAM_ACCESS_TOKEN_KEY,
      value: accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) {
    throw new Error(`integration_secrets upsert failed: ${error.message}`);
  }
}

export async function refreshInstagramAccessToken(
  currentToken: string
): Promise<{ accessToken: string; expiresAt: string; expiresIn: number }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", currentToken);

  const res = await fetch(url.toString());
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      typeof body === "object" && body
        ? JSON.stringify(body).slice(0, 240)
        : String(body ?? "");
    throw new Error(`Instagram token refresh ${res.status}: ${detail}`);
  }

  const parsed = parseInstagramRefreshResponse(body);
  if (!parsed) {
    throw new Error("Instagram token refresh: geçersiz yanıt");
  }

  const expiresAt = computeTokenExpiresAt(parsed.expiresIn);
  await saveInstagramAccessToken(parsed.accessToken, expiresAt);

  return {
    accessToken: parsed.accessToken,
    expiresAt,
    expiresIn: parsed.expiresIn,
  };
}
