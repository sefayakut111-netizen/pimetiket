/**
 * Site Images — CLIENT-SIDE helper + React hook.
 *
 * Bu dosya SADECE client component'lerde (`"use client"` ile başlayan)
 * import edilmeli. Server tarafı için `site-images.ts` (getSiteImage)
 * kullan — bu dosya `createBrowserClient` ile çalışır.
 *
 * Client-side kullanımı:
 *   const hero = useSiteImage("sablonlar_hero");
 *   {hero ? <img src={hero.publicUrl} alt={hero.altText} /> : <DefaultPim />}
 */

"use client";

import { useEffect, useState } from "react";
import { createClient as createBrowserClient } from "./supabase/client";
import { rowToImage, type SiteImage, type DbRow } from "./site-images-types";

export type { SiteImage } from "./site-images-types";

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
