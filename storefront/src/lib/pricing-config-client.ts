/**
 * Pricing Config — CLIENT-SAFE versiyon.
 *
 * Sefa 19 May v68 (Faz 2):
 *   Müşteri /sticker, /etiket sayfaları admin live_config'i okurken
 *   server-only pricing-config.ts'i bundle'a sokuyordu (createAdminClient →
 *   next/headers cookies() patladı). Bu dosya sadece browser supabase
 *   kullanır — admin.ts referansı yok.
 *
 * Sadece okuma: getLivePricingConfig + cache.
 * Admin yazma operasyonları için `pricing-config.ts` (server-only).
 */

import { createClient } from "@/lib/supabase/client";
import type {
  ScopeName,
  ScopeConfig,
  ProfileConfig,
} from "./pricing-config-types";
import {
  FALLBACK_STICKER_CONFIG,
  FALLBACK_ETIKET_RULO_CONFIG,
  FALLBACK_ETIKET_TABAKA_CONFIG,
} from "./pricing-config-types";

// ============================================================
// Cache (5 dakika)
// ============================================================

interface CacheEntry {
  config: ScopeConfig;
  expiresAt: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000;
const liveCache = new Map<ScopeName, CacheEntry>();

function getCached(scope: ScopeName): ScopeConfig | null {
  const entry = liveCache.get(scope);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    liveCache.delete(scope);
    return null;
  }
  return entry.config;
}

function setCached(scope: ScopeName, config: ScopeConfig): void {
  liveCache.set(scope, {
    config,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidatePricingCacheClient(scope?: ScopeName): void {
  if (scope) liveCache.delete(scope);
  else liveCache.clear();
}

function getFallback(scope: ScopeName): ScopeConfig {
  switch (scope) {
    case "sticker":
      return FALLBACK_STICKER_CONFIG;
    case "etiket_rulo":
      return FALLBACK_ETIKET_RULO_CONFIG;
    case "etiket_tabaka":
      return FALLBACK_ETIKET_TABAKA_CONFIG;
    default:
      return FALLBACK_STICKER_CONFIG;
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Browser-safe live config reader. Müşteri /sticker, /etiket'ten çağrılır.
 *
 * Pricing config tablosunun RLS'i `SELECT` için public olmalı
 * (Migration 047 ile zaten public read açık).
 */
export async function getLivePricingConfig<
  T extends ScopeConfig = ProfileConfig
>(scope: ScopeName): Promise<T> {
  const cached = getCached(scope);
  if (cached) return cached as T;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pricing_config")
      .select("live_config")
      .eq("scope", scope)
      .maybeSingle();

    if (error || !data) {
      console.warn(
        `[pricing-config-client] DB read failed for ${scope}, fallback`
      );
      return getFallback(scope) as T;
    }

    const cfg = (data as { live_config: ScopeConfig }).live_config;
    if (!cfg || Object.keys(cfg).length === 0) {
      return getFallback(scope) as T;
    }
    setCached(scope, cfg);
    return cfg as T;
  } catch (err) {
    console.error("[pricing-config-client] unexpected error:", err);
    return getFallback(scope) as T;
  }
}
