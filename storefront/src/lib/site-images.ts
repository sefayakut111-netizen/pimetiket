/**
 * Site Images public helper — server-side ve client-side okuma.
 *
 * Admin panelinden yüklenen slot bazlı görselleri çeker. Bucket
 * `public-assets` olduğu için authenticated/anon herkes okur.
 *
 * Server-side kullanımı (SSR — anasayfa için ideal):
 *   const hero = await getSiteImage("home_hero");
 *   if (hero) <img src={hero.publicUrl} alt={hero.altText} />
 *
 * Client-side kullanımı:
 *   const [img, setImg] = useState<SiteImage|null>(null);
 *   useEffect(() => { getSiteImageClient("home_hero").then(setImg); }, []);
 *
 * Performans: 60 saniye cache (Next.js fetch cache). Görseller anında
 * güncellenmez — Sefa admin'den değiştirince max 1 dk içinde yayılır.
 */

import { useEffect, useState } from "react";
import { createClient as createServerClient } from "./supabase/server";
import { createClient as createBrowserClient } from "./supabase/client";

const BUCKET = "public-assets";

export interface SiteImage {
  slot: string;
  storagePath: string;
  publicUrl: string;
  altText: string | null;
  title: string | null;
  linkUrl: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

interface DbRow {
  slot: string;
  storage_path: string;
  alt_text: string | null;
  title: string | null;
  link_url: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
}

function rowToImage(
  row: DbRow,
  supabaseUrl: string
): SiteImage {
  // public-assets bucket için doğrudan public URL
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${row.storage_path}`;
  return {
    slot: row.slot,
    storagePath: row.storage_path,
    publicUrl,
    altText: row.alt_text,
    title: row.title,
    linkUrl: row.link_url,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
  };
}

/** Server-side: tek slot çek */
export async function getSiteImage(
  slot: string
): Promise<SiteImage | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("site_images")
      .select(
        "slot, storage_path, alt_text, title, link_url, width, height, mime_type"
      )
      .eq("slot", slot)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    return rowToImage(data as DbRow, url);
  } catch {
    return null;
  }
}

/** Server-side: birden fazla slot tek seferde */
export async function getSiteImages(
  slots: string[]
): Promise<Record<string, SiteImage>> {
  if (slots.length === 0) return {};
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("site_images")
      .select(
        "slot, storage_path, alt_text, title, link_url, width, height, mime_type"
      )
      .in("slot", slots)
      .eq("is_active", true);
    if (error || !data) return {};
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const result: Record<string, SiteImage> = {};
    for (const row of data as DbRow[]) {
      result[row.slot] = rowToImage(row, url);
    }
    return result;
  } catch {
    return {};
  }
}

// ============================================================
// Client-side hook + helper
// ============================================================

/**
 * React hook — client component'lerde slot bazlı görsel çek.
 *
 * @example
 *   const hero = useSiteImage("sablonlar_hero");
 *   {hero ? <img src={hero.publicUrl} alt={hero.altText} /> : <DefaultPim />}
 */
export function useSiteImage(slot: string): SiteImage | null {
  const [img, setImg] = useState<SiteImage | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSiteImageClient(slot).then((result) => {
      if (!cancelled) setImg(result);
    });
    return () => {
      cancelled = true;
    };
  }, [slot]);
  return img;
}

/** Client-side: tek slot çek (live update senaryoları için) */
export async function getSiteImageClient(
  slot: string
): Promise<SiteImage | null> {
  try {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from("site_images")
      .select(
        "slot, storage_path, alt_text, title, link_url, width, height, mime_type"
      )
      .eq("slot", slot)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    return rowToImage(data as DbRow, url);
  } catch {
    return null;
  }
}
