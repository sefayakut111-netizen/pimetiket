/**
 * Sunucu tarafı SEO site ayarları (site_settings + env fallback).
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface SeoSiteConfig {
  socialLinks: string[];
  contactPhone?: string;
}

// Sefa 4 Haz: resmî sosyal hesaplar — JSON-LD sameAs varsayılanı (entity SEO).
// Öncelik: DB site_settings.social_links > env NEXT_PUBLIC_SOCIAL_LINKS > bu liste.
// Admin → Ayarlar'dan girilen değer her zaman bunları override eder.
const DEFAULT_SOCIAL_LINKS = [
  "https://instagram.com/pimetiket",
  "https://x.com/pimetiket",
  "https://pinterest.com/pimetiket",
  "https://youtube.com/@pimetiket",
];

function parseSocialLinks(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    const env = (process.env.NEXT_PUBLIC_SOCIAL_LINKS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("https://"));
    return env.length > 0 ? env : DEFAULT_SOCIAL_LINKS;
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("https://"));
}

export async function getSeoSiteConfig(): Promise<SeoSiteConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { socialLinks: parseSocialLinks(undefined) };
  }

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await supabase
    .from("site_settings")
    .select("social_links, seo_contact_phone")
    .eq("id", 1)
    .maybeSingle();

  const row = data as {
    social_links?: string | null;
    seo_contact_phone?: string | null;
  } | null;

  const socialLinks = parseSocialLinks(row?.social_links);
  const contactPhone =
    row?.seo_contact_phone?.trim() ||
    process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() ||
    undefined;

  return { socialLinks, contactPhone };
}
