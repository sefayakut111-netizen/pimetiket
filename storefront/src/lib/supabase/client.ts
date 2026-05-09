/**
 * Supabase browser client — Client component'larda kullan.
 *
 * Cookie-based session (SSR uyumlu) — @supabase/ssr `createBrowserClient`
 * env değişkenleri:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env değişkenleri eksik. .env.local'e NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ekle."
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}

/** Auth + Supabase ayarları henüz konfigüre edildi mi? UI fallback için */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
