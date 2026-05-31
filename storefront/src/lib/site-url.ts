/**
 * Tek kaynak: public site kök URL (metadata, schema, sitemap, mail).
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "https://pimetiket.com";
  return "http://localhost:3000";
}
