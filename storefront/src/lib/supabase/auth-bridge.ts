/**
 * Supabase auth-bridge — client-side store'ların DB ↔ localStorage hibridini
 * yönetmek için yardımcılar.
 *
 * Strateji:
 *   - Auth YOKSA  → localStorage (guest cart, pre-login deneyim)
 *   - Auth VARSA  → Supabase (multi-device sync, KVKK uyumlu)
 *   - Login OLDU  → localStorage'daki guest data DB'ye merge edilir,
 *                   sonra localStorage temizlenir
 *
 * Bu modül Supabase env yokken bile çalışır; isSupabaseConfigured()
 * false dönerse hibrit otomatik localStorage moduna düşer.
 */

import { createClient, isSupabaseConfigured } from "./client";
import type { User } from "@supabase/supabase-js";

// ============================================================
// Cached user lookup (browser session boyunca)
// ============================================================

let cachedUser: User | null | undefined = undefined; // undefined = henüz query atılmadı
let userPromise: Promise<User | null> | null = null;

/**
 * Aktif kullanıcıyı dön (varsa). İlk çağrıda cache'ler.
 * Logout/login event'lerinde clearUserCache() çağrılmalı.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null;
  if (cachedUser !== undefined) return cachedUser;

  if (!userPromise) {
    userPromise = (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) return null;
        cachedUser = data.user;
        return data.user;
      } catch {
        return null;
      }
    })();
  }

  return userPromise;
}

export function clearUserCache(): void {
  cachedUser = undefined;
  userPromise = null;
}

/**
 * Auth event listener — login/logout olduğunda cache'i temizle ve
 * dispatcher'ları tetikle. App root'unda 1 kez çağrılmalı.
 */
export function bindAuthEvents(): () => void {
  if (!isSupabaseConfigured()) return () => {};
  if (typeof window === "undefined") return () => {};

  const supabase = createClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cachedUser = session?.user ?? null;
    if (event === "SIGNED_IN") {
      window.dispatchEvent(new CustomEvent("pim_auth_signed_in"));
    } else if (event === "SIGNED_OUT") {
      window.dispatchEvent(new CustomEvent("pim_auth_signed_out"));
    }
  });

  return () => data.subscription.unsubscribe();
}

// ============================================================
// Hibrit yardımcısı — auth varsa DB, yoksa fallback
// ============================================================

/**
 * Kısa-yol: kullanıcı login mi? Synchronous best-effort
 * (cache'lenmiş user'a göre). İlk paint için doğru olmayabilir.
 */
export function isLoggedInSync(): boolean {
  return Boolean(cachedUser);
}

/**
 * Auth + Supabase mevcutsa true.
 * Async ama hızlı: cache'li user kontrolü.
 */
export async function isLoggedIn(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const u = await getCurrentUser();
  return Boolean(u);
}

// ============================================================
// Telemetry — store'ların hangi modda çalıştığını UI gösterebilir
// ============================================================

export type StoreMode = "supabase" | "local";

export async function getStoreMode(): Promise<StoreMode> {
  return (await isLoggedIn()) ? "supabase" : "local";
}
