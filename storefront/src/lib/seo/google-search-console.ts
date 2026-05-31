/**
 * Google Search Console API — sitemap gönderimi (service account).
 *
 * Ön koşul (tek sefer, ~5 dk):
 * 1. Google Cloud → Search Console API etkin
 * 2. Service account → GA4 ile aynı veya yeni
 * 3. Search Console → Ayarlar → Kullanıcılar → SA e-postasını "Owner" veya "Full" ekle
 * 4. Vercel env: GSC_SITE_URL, GSC_SA_CLIENT_EMAIL, GSC_SA_PRIVATE_KEY
 *    (GA4 Data API ile aynı SA kullanılabilir — webmasters scope eklenir)
 */

import { GoogleAuth } from "google-auth-library";

const WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters";

export interface GscSubmitResult {
  configured: boolean;
  ok: boolean;
  status?: number;
  detail: string;
}

function getCredentials():
  | { client_email: string; private_key: string }
  | null {
  const email =
    process.env.GSC_SA_CLIENT_EMAIL?.trim() ||
    process.env.GA4_SA_CLIENT_EMAIL?.trim();
  const key = (
    process.env.GSC_SA_PRIVATE_KEY || process.env.GA4_SA_PRIVATE_KEY
  )?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return { client_email: email, private_key: key };
}

function siteUrl(): string {
  const raw =
    process.env.GSC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://pimetiket.com";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export async function submitGscSitemap(
  feedpath?: string
): Promise<GscSubmitResult> {
  const creds = getCredentials();
  if (!creds) {
    return {
      configured: false,
      ok: false,
      detail:
        "GSC_SA_* veya GA4_SA_* env yok — Search Console API sitemap gönderilemedi.",
    };
  }

  const base = siteUrl().replace(/\/$/, "");
  const sitemapFeed =
    feedpath ?? process.env.GSC_SITEMAP_URL ?? `${base}/sitemap.xml`;

  try {
    const auth = new GoogleAuth({
      credentials: creds,
      scopes: [WEBMASTERS_SCOPE],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) {
      return {
        configured: true,
        ok: false,
        detail: "Access token alınamadı",
      };
    }

    const site = encodeURIComponent(siteUrl());
    const url = `https://www.googleapis.com/webmasters/v3/sites/${site}/sitemaps`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ feedpath: sitemapFeed }),
      cache: "no-store",
    });

    const text = await res.text();
    if (res.ok || res.status === 409) {
      return {
        configured: true,
        ok: true,
        status: res.status,
        detail:
          res.status === 409
            ? "Sitemap zaten kayıtlı (409) — yenileme kabul edildi sayılır."
            : text.slice(0, 200) || "Sitemap gönderildi",
      };
    }

    return {
      configured: true,
      ok: false,
      status: res.status,
      detail: text.slice(0, 300),
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
