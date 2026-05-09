/**
 * Supabase admin client — service_role key ile, RLS bypass eder.
 *
 * SADECE server-side (route handler / Server Action / Edge fn). Client
 * bundle'a sızdırma — kullanıcı kimlik doğrulamasız tüm DB'yi silebilir.
 *
 * Kullanım örnekleri:
 *   - Webhook handler'ları (PSP callback)
 *   - Admin endpoint'leri (status update, refund, moderation)
 *   - Audit log INSERT (server-side)
 *
 * Kullanıcı bağlamı yok → auth.uid() null. RLS atlanır.
 */

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createSupabaseClient> | null = null;

export function createAdminClient() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY eksik. .env.local'e ekle (server-only)."
    );
  }

  _admin = createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _admin;
}
