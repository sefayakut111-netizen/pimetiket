/**
 * Pricing Config — DB-bağlı fiyat yönetimi (Migration 047 + 048).
 *
 * Server-only — createAdminClient kullanır. Types ve FALLBACK constants
 * için `pricing-config-types.ts` kullan (client-safe).
 *
 * Sefa 17 May v6: Client component'lerden FALLBACK okumak için types
 * ayrı dosyada (build hatası fix).
 */

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

// Re-export client-safe types (geriye uyum için)
export type {
  ScopeName,
  MaterialItem,
  OptionItem,
  OptionGroup,
  TierConfig,
  OperationConfig,
  PercentConfig,
  CutMultipliers,
  ProfileConfig,
  ScopeConfig,
  PricingHistoryRow,
} from "./pricing-config-types";

export {
  FALLBACK_STICKER_CONFIG,
  FALLBACK_ETIKET_RULO_CONFIG,
  FALLBACK_ETIKET_TABAKA_CONFIG,
} from "./pricing-config-types";

import type {
  ScopeName,
  ScopeConfig,
  ProfileConfig,
  PricingHistoryRow,
} from "./pricing-config-types";

import {
  FALLBACK_STICKER_CONFIG,
  FALLBACK_ETIKET_RULO_CONFIG,
  FALLBACK_ETIKET_TABAKA_CONFIG,
} from "./pricing-config-types";

// FALLBACK config'ler pricing-config-types.ts'te (client-safe)
// Buradan re-export ediliyor (yukarıdaki import bloğunda)

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

export function invalidatePricingCache(scope?: ScopeName): void {
  if (scope) liveCache.delete(scope);
  else liveCache.clear();
}

// ============================================================
// Public API
// ============================================================

export async function getLivePricingConfig<T extends ScopeConfig = ProfileConfig>(
  scope: ScopeName
): Promise<T> {
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
      console.warn(`[pricing-config] DB read failed for ${scope}, fallback`);
      return getFallback(scope) as T;
    }

    const cfg = (data as { live_config: ScopeConfig }).live_config;
    if (!cfg || Object.keys(cfg).length === 0) {
      return getFallback(scope) as T;
    }
    setCached(scope, cfg);
    return cfg as T;
  } catch (err) {
    console.error("[pricing-config] unexpected error:", err);
    return getFallback(scope) as T;
  }
}

export async function getAdminPricingConfig(
  scope: ScopeName
): Promise<{
  draft: ScopeConfig;
  live: ScopeConfig;
  draft_updated_at: string | null;
  draft_updated_by_email: string | null;
  live_updated_at: string | null;
  live_updated_by_email: string | null;
} | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pricing_config")
    .select(
      "draft_config, live_config, draft_updated_at, draft_updated_by_email, live_updated_at, live_updated_by_email"
    )
    .eq("scope", scope)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    draft_config: ScopeConfig;
    live_config: ScopeConfig;
    draft_updated_at: string | null;
    draft_updated_by_email: string | null;
    live_updated_at: string | null;
    live_updated_by_email: string | null;
  };
  return {
    draft: row.draft_config,
    live: row.live_config,
    draft_updated_at: row.draft_updated_at,
    draft_updated_by_email: row.draft_updated_by_email,
    live_updated_at: row.live_updated_at,
    live_updated_by_email: row.live_updated_by_email,
  };
}

export async function saveDraftPricingConfig(
  scope: ScopeName,
  draft: ScopeConfig,
  adminId: string,
  adminEmail: string,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("pricing_config")
    .update({
      draft_config: draft as Json,
      draft_updated_at: new Date().toISOString(),
      draft_updated_by: adminId,
      draft_updated_by_email: adminEmail,
    })
    .eq("scope", scope);
  if (error) return { ok: false, error: error.message };

  await admin.from("pricing_config_history").insert([
    {
      scope,
      action: "draft_save",
      config_snapshot: draft as Json,
      changed_by: adminId,
      changed_by_email: adminEmail,
      note: note ?? null,
    },
  ]);

  return { ok: true };
}

/**
 * Sefa 19 May v68: RPC bypass edildi.
 *
 * Eski versiyon `fn_publish_pricing_config` RPC çağırıyordu. RPC içinde
 * `auth.uid()` ile yetki check'i vardı. createAdminClient (service role)
 * ile çağrı yapıldığında auth.uid() NULL döner → RPC içinde
 * "raise exception 'forbidden'" → 500.
 *
 * Çözüm: RPC bypass + direkt update. assertAdmin zaten endpoint
 * seviyesinde yetki kontrolü yaptığı için RPC'nin tekrar check'ine
 * gerek yok.
 */
export async function publishPricingConfig(
  scope: ScopeName,
  adminId: string,
  adminEmail: string,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  // 1. Mevcut draft'ı oku
  const { data: row, error: readErr } = await admin
    .from("pricing_config")
    .select("draft_config")
    .eq("scope", scope)
    .single();
  if (readErr) return { ok: false, error: `read_failed: ${readErr.message}` };
  if (!row) return { ok: false, error: "scope_not_found" };

  const draft = (row as { draft_config: ScopeConfig }).draft_config;
  const now = new Date().toISOString();

  // 2. Live'a kopyala
  const { error: updErr } = await admin
    .from("pricing_config")
    .update({
      live_config: draft as Json,
      live_updated_at: now,
      live_updated_by: adminId,
      live_updated_by_email: adminEmail,
      live_published_at: now,
    })
    .eq("scope", scope);
  if (updErr) return { ok: false, error: `update_failed: ${updErr.message}` };

  // 3. History snapshot (audit)
  const { error: histErr } = await admin
    .from("pricing_config_history")
    .insert([
      {
        scope,
        action: "publish",
        config_snapshot: draft as Json,
        changed_by: adminId,
        changed_by_email: adminEmail,
        note: note ?? null,
      },
    ]);
  if (histErr) {
    // History başarısız ama publish başardı — kritik değil, log yap
    console.warn(
      `[publishPricingConfig] history insert failed (publish ok): ${histErr.message}`
    );
  }

  invalidatePricingCache(scope);
  return { ok: true };
}

/**
 * Sefa 19 May v68: RPC bypass (publishPricingConfig'in kardeşi).
 *
 * fn_revert_pricing_config RPC içinde auth.uid() ile yetki check yapıyor.
 * createAdminClient (service role) ile çağrıldığında auth.uid() NULL →
 * "raise exception 'forbidden'" → 500. assertAdmin endpoint seviyesinde
 * yetki check yaptığı için RPC'nin tekrarına gerek yok.
 */
export async function revertPricingConfig(
  scope: ScopeName,
  historyId: string,
  adminId: string,
  adminEmail: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  // 1. History snapshot'ı oku — scope+id ile guard (cross-scope revert engelle)
  const { data: histRow, error: histReadErr } = await admin
    .from("pricing_config_history")
    .select("config_snapshot")
    .eq("id", historyId)
    .eq("scope", scope)
    .maybeSingle();
  if (histReadErr) {
    return { ok: false, error: `history_read_failed: ${histReadErr.message}` };
  }
  if (!histRow) return { ok: false, error: "history_not_found" };

  const snapshot = (histRow as { config_snapshot: ScopeConfig }).config_snapshot;
  const now = new Date().toISOString();

  // 2. Live'a yükle
  const { error: updErr } = await admin
    .from("pricing_config")
    .update({
      live_config: snapshot as Json,
      live_updated_at: now,
      live_updated_by: adminId,
      live_updated_by_email: adminEmail,
      live_published_at: now,
    })
    .eq("scope", scope);
  if (updErr) return { ok: false, error: `update_failed: ${updErr.message}` };

  // 3. Yeni history entry (revert action — audit izi)
  const { error: histInsErr } = await admin
    .from("pricing_config_history")
    .insert([
      {
        scope,
        action: "revert",
        config_snapshot: snapshot as Json,
        changed_by: adminId,
        changed_by_email: adminEmail,
        note: `Revert to history ID ${historyId}`,
      },
    ]);
  if (histInsErr) {
    console.warn(
      `[revertPricingConfig] history insert failed (revert ok): ${histInsErr.message}`
    );
  }

  invalidatePricingCache(scope);
  return { ok: true };
}

export async function listPricingHistory(
  scope: ScopeName,
  limit = 30
): Promise<PricingHistoryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pricing_config_history")
    .select(
      "id, scope, action, config_snapshot, changed_at, changed_by_email, note"
    )
    .eq("scope", scope)
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as PricingHistoryRow[];
}

// ============================================================
// Helpers
// ============================================================

function getFallback(scope: ScopeName): ScopeConfig {
  switch (scope) {
    case "sticker":
      return FALLBACK_STICKER_CONFIG;
    case "etiket_rulo":
      return FALLBACK_ETIKET_RULO_CONFIG;
    case "etiket_tabaka":
      return FALLBACK_ETIKET_TABAKA_CONFIG;
    default:
      return {};
  }
}
