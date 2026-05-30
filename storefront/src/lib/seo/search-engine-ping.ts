/**
 * Arama motorlarına sitemap güncellemesi bildirimi (ücretsiz ping endpoint'leri).
 * Search Console API OAuth gerektirmez; deploy veya haftalık SEO cron sonrası kullanılır.
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

export interface SitemapPingResult {
  engine: "google" | "bing";
  ok: boolean;
  status: number;
  detail: string;
}

export function sitemapUrl(): string {
  return `${SITE_URL.replace(/\/$/, "")}/sitemap.xml`;
}

/** Google legacy sitemap ping (Search Console hesabı doğrulandıktan sonra) */
export async function pingGoogleSitemap(
  url = sitemapUrl()
): Promise<SitemapPingResult> {
  const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(pingUrl, { method: "GET", cache: "no-store" });
    const text = await res.text();
    return {
      engine: "google",
      ok: res.ok,
      status: res.status,
      detail: text.slice(0, 200) || res.statusText,
    };
  } catch (err) {
    return {
      engine: "google",
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Bing legacy sitemap ping */
export async function pingBingSitemap(
  url = sitemapUrl()
): Promise<SitemapPingResult> {
  const pingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(pingUrl, { method: "GET", cache: "no-store" });
    const text = await res.text();
    return {
      engine: "bing",
      ok: res.ok,
      status: res.status,
      detail: text.slice(0, 200) || res.statusText,
    };
  } catch (err) {
    return {
      engine: "bing",
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function pingAllSearchEngines(
  url = sitemapUrl()
): Promise<SitemapPingResult[]> {
  return Promise.all([pingGoogleSitemap(url), pingBingSitemap(url)]);
}
