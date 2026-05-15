/**
 * Site Images — SERVER-SIDE helper.
 *
 * Bu dosya SADECE server component'lerde import edilmeli (layout.tsx,
 * blog/[slug]/page.tsx gibi). Client component'lerde site-images-client.ts
 * import edilmeli — `"use client"` direktifiyle başlayan dosyalar
 * `createServerClient`'i bundle'a çekemez (next/headers kullanır).
 *
 * Server-side kullanımı:
 *   const hero = await getSiteImage("home_hero");
 *   if (hero) <img src={hero.publicUrl} alt={hero.altText} />
 *
 * Performans: Next.js fetch cache otomatik 60 sn cache yapar.
 */

import { createClient as createServerClient } from "./supabase/server";
import {
  rowToImage,
  type SiteImage,
  type DbRow,
} from "./site-images-types";

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

// Re-export type for backwards compat
export type { SiteImage } from "./site-images-types";
