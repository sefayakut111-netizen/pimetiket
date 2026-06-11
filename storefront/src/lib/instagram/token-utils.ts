export const INSTAGRAM_ACCESS_TOKEN_KEY = "instagram_access_token";

export type InstagramTokenSource = "db" | "env" | "none";

export interface InstagramTokenStatus {
  source: InstagramTokenSource;
  hasToken: boolean;
  updatedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
}

/** DB öncelikli token çözümü (unit test / verify). */
export function resolveInstagramTokenPriority(
  dbValue: string | null | undefined,
  envValue: string | null | undefined
): { token: string | null; source: InstagramTokenSource } {
  const dbToken = dbValue?.trim();
  if (dbToken) return { token: dbToken, source: "db" };
  const envToken = envValue?.trim();
  if (envToken) return { token: envToken, source: "env" };
  return { token: null, source: "none" };
}

export function parseInstagramRefreshResponse(
  body: unknown
): { accessToken: string; expiresIn: number } | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const accessToken =
    typeof row.access_token === "string" ? row.access_token.trim() : "";
  const rawExpires =
    typeof row.expires_in === "number"
      ? row.expires_in
      : Number(row.expires_in);
  if (!accessToken || !Number.isFinite(rawExpires) || rawExpires <= 0) {
    return null;
  }
  return { accessToken, expiresIn: rawExpires };
}

export function computeTokenExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function daysUntilIso(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
