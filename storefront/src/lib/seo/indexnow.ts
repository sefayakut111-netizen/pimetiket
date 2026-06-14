/**
 * IndexNow — Bing/Yandex vb. için URL bildirimi (Google hesabı gerekmez).
 * Key dosyası: public/{INDEXNOW_KEY}.txt
 */

import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { INDEXNOW_HTTP_TIMEOUT_MS } from "@/lib/http/external-timeouts";
import { getSiteUrl } from "@/lib/site-url";

function siteHost(): string {
  return getSiteUrl().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export interface IndexNowResult {
  configured: boolean;
  ok: boolean;
  status?: number;
  urlCount: number;
  detail: string;
}

export function indexNowKey(): string | undefined {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && key.length >= 8 && key.length <= 128 ? key : undefined;
}

export function indexNowKeyLocation(key: string): string {
  return `https://${siteHost()}/${key}.txt`;
}

/** Sitemap.xml içinden <loc> URL'lerini çıkar */
export function parseSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

export async function submitIndexNow(
  urls: string[]
): Promise<IndexNowResult> {
  const key = indexNowKey();
  if (!key) {
    return {
      configured: false,
      ok: false,
      urlCount: urls.length,
      detail: "INDEXNOW_KEY env tanımlı değil",
    };
  }

  if (urls.length === 0) {
    return {
      configured: true,
      ok: false,
      urlCount: 0,
      detail: "Gönderilecek URL yok",
    };
  }

  const body = {
    host: siteHost(),
    key,
    keyLocation: indexNowKeyLocation(key),
    urlList: urls.slice(0, 10_000),
  };

  try {
    const res = await fetchWithTimeout("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      cache: "no-store",
      timeoutMs: INDEXNOW_HTTP_TIMEOUT_MS,
    });

    return {
      configured: true,
      ok: res.ok || res.status === 202,
      status: res.status,
      urlCount: urls.length,
      detail: res.ok
        ? `IndexNow ${urls.length} URL bildirildi`
        : `${res.status} ${await res.text().catch(() => "")}`.slice(0, 200),
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      urlCount: urls.length,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function submitIndexNowFromSitemap(
  sitemapUrl?: string
): Promise<IndexNowResult> {
  const url = sitemapUrl ?? `${getSiteUrl()}/sitemap.xml`;

  try {
    const res = await fetchWithTimeout(url, {
      cache: "no-store",
      timeoutMs: INDEXNOW_HTTP_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        configured: Boolean(indexNowKey()),
        ok: false,
        urlCount: 0,
        detail: `Sitemap fetch HTTP ${res.status}`,
      };
    }
    const xml = await res.text();
    return submitIndexNow(parseSitemapLocs(xml));
  } catch (err) {
    return {
      configured: Boolean(indexNowKey()),
      ok: false,
      urlCount: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
