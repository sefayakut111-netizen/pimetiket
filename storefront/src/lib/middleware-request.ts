import type { NextRequest } from "next/server";

/** Next.js App Router RSC prefetch — ?_rsc= veya sec-fetch imzası */
export function isRscPrefetchRequest(request: NextRequest): boolean {
  if (request.nextUrl.searchParams.has("_rsc")) return true;

  const dest = request.headers.get("sec-fetch-dest");
  const mode = request.headers.get("sec-fetch-mode");
  if (dest === "empty" && mode === "cors" && request.headers.has("next-url")) {
    return true;
  }

  const purpose = request.headers.get("purpose") ?? request.headers.get("sec-purpose");
  if (purpose === "prefetch") return true;

  return false;
}

export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );
}

/** Ağır sayfalar — viewport prefetch kapalı tutulmalı */
export const HEAVY_ROUTE_PREFIXES = [
  "/sticker/yapilandir",
  "/etiket/yapilandir",
  "/editor",
  "/odeme",
  "/admin",
] as const;

export function isHeavyRoute(pathname: string): boolean {
  return HEAVY_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
