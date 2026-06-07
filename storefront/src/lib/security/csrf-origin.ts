import { getSiteUrl } from "@/lib/site-url";

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Kritik POST endpoint'lerinde cross-site istekleri reddet. */
export function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    const originNorm = normalizeOrigin(origin);
    if (!originNorm) return false;

    const allowedOrigins = new Set<string>();
    for (const base of [
      getSiteUrl(),
      "http://localhost:3000",
      "https://pimetiket.com",
      "https://www.pimetiket.com",
    ]) {
      const o = normalizeOrigin(base);
      if (o) allowedOrigins.add(o);
    }

    return allowedOrigins.has(originNorm);
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}
