/**
 * Open redirect guard — `next` parametresinin sadece site içi path olmasını sağlar.
 */
export function sanitizeNextPath(
  raw: string | null | undefined,
  fallback = "/panelim"
): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.length > 1 && (raw[1] === "/" || raw[1] === "\\")) return fallback;
  if (raw.length > 512) return fallback;
  return raw;
}
