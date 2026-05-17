/**
 * Pricing Config — DB-bağlı fiyat yönetimi (Migration 047).
 *
 * Sefa 17 May: "fiyat girebileceim bir alan yok".
 *
 * 3 scope: 'sticker', 'etiket', 'global'.
 * Her scope draft + live tutar. Müşteri tarafı LIVE okur, admin DRAFT'ta
 * çalışıp "Canlıya yayınla" butonuyla LIVE'e geçirir.
 *
 * Cache: 5 dakika in-memory (LIVE config için). DB unreachable senaryosunda
 * fallback default değerler (hardcoded constants'tan).
 */

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Types
// ============================================================

export interface ProductionConfig {
  mode: "fason" | "uretim";
  fasonRate: number;
  paper?: number;
  ink?: number;
  coating?: number;
  labor?: number;
  overhead?: number;
  depreciation?: number;
}

export interface OperationConfig {
  setup: number;
  packaging: number;
  cargo: number;
  feePct: number;
}

export interface MarginConfigStored {
  marginPct: number;
  vatPct: number;
  minMarkupFraction: number;
}

export interface TierConfig {
  qty: number;
  multiplier: number;
  label: string;
}

export interface MultiplierItem {
  id: string;
  name: string;
  desc: string;
  multiplier: number;
}

export interface StickerScopeConfig {
  production: ProductionConfig;
  operation: OperationConfig;
  margin: MarginConfigStored;
  tiers: TierConfig[];
}

export interface EtiketScopeConfig {
  production: ProductionConfig;
  operation: OperationConfig;
  margin: MarginConfigStored;
  tiers: TierConfig[];
  materials: MultiplierItem[];
  coatings: MultiplierItem[];
  customizations: MultiplierItem[];
}

export type ScopeName = "sticker" | "etiket" | "global";
export type ScopeConfig =
  | StickerScopeConfig
  | EtiketScopeConfig
  | Record<string, unknown>;

export interface PricingConfigRow {
  scope: ScopeName;
  draft_config: ScopeConfig;
  live_config: ScopeConfig;
  draft_updated_at: string;
  draft_updated_by_email: string | null;
  live_updated_at: string;
  live_updated_by_email: string | null;
  live_published_at: string;
}

export interface PricingHistoryRow {
  id: string;
  scope: ScopeName;
  action: "draft_save" | "publish" | "revert";
  config_snapshot: ScopeConfig;
  changed_at: string;
  changed_by_email: string | null;
  note: string | null;
}

// ============================================================
// Fallback defaults — Migration 047 ile aynı (DB unreachable senaryo)
// ============================================================

export const FALLBACK_STICKER_CONFIG: StickerScopeConfig = {
  production: { mode: "fason", fasonRate: 0.40 },
  operation: { setup: 50, packaging: 0.01, cargo: 80, feePct: 2.5 },
  margin: { marginPct: 50, vatPct: 20, minMarkupFraction: 0.10 },
  tiers: [
    { qty: 25, multiplier: 1.30, label: "+%30 zam" },
    { qty: 50, multiplier: 1.20, label: "+%20 zam" },
    { qty: 100, multiplier: 1.10, label: "+%10 zam" },
    { qty: 250, multiplier: 1.00, label: "referans" },
    { qty: 500, multiplier: 0.90, label: "-%10 indirim" },
    { qty: 1000, multiplier: 0.80, label: "-%20 indirim" },
  ],
};

export const FALLBACK_ETIKET_CONFIG: EtiketScopeConfig = {
  production: { mode: "fason", fasonRate: 0.35 },
  operation: { setup: 80, packaging: 0.015, cargo: 80, feePct: 2.5 },
  margin: { marginPct: 50, vatPct: 20, minMarkupFraction: 0.10 },
  tiers: [
    { qty: 1000, multiplier: 1.10, label: "+%10 zam" },
    { qty: 2000, multiplier: 1.05, label: "+%5 zam" },
    { qty: 5000, multiplier: 1.00, label: "referans" },
    { qty: 10000, multiplier: 0.95, label: "-%5 indirim" },
    { qty: 20000, multiplier: 0.90, label: "-%10 indirim" },
    { qty: 50000, multiplier: 0.82, label: "-%18 indirim" },
  ],
  materials: [
    { id: "kraft", name: "Kraft", desc: "Doğal, dokunsal", multiplier: 1.00 },
    { id: "kuse", name: "Kuşe", desc: "Mat kaplamalı baskı kağıdı", multiplier: 1.05 },
    { id: "beyaz", name: "Beyaz semi-glos", desc: "Klasik, parlak", multiplier: 1.10 },
    { id: "ultra", name: "Ultra clear", desc: "Şeffaf cam etkisi", multiplier: 1.35 },
    { id: "metalik", name: "Metalik", desc: "Folyo gümüş", multiplier: 1.60 },
  ],
  coatings: [
    { id: "yok", name: "Kaplamasız", desc: "Kâğıt dokusu kalsın", multiplier: 1.00 },
    { id: "mat", name: "Mat selefon", desc: "Yansımasız, premium", multiplier: 1.15 },
    { id: "parlak", name: "Parlak selefon", desc: "Canlı, temiz", multiplier: 1.15 },
    { id: "soft", name: "Soft touch", desc: "Velvet his", multiplier: 1.30 },
  ],
  customizations: [
    { id: "yok", name: "Özelleştirme yok", desc: "Sade baskı", multiplier: 1.00 },
    { id: "emboss", name: "Kabartma (emboss)", desc: "Logo/metin kabartması", multiplier: 1.30 },
    { id: "yaldiz", name: "Sıcak yaldız", desc: "Folyo baskı, premium parıltı", multiplier: 1.50 },
    { id: "spotuv", name: "Spot UV", desc: "Parlak nokta vurgu", multiplier: 1.25 },
  ],
};

// ============================================================
// Cache (5 dakika)
// ============================================================

interface CacheEntry {
  config: ScopeConfig;
  expiresAt: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika
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

/**
 * Live config oku (müşteri sayfası + sipariş akışı).
 * Cache + DB + fallback.
 */
export async function getLivePricingConfig<T extends ScopeConfig>(
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

/**
 * Admin için: hem draft hem live oku.
 */
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

/**
 * Draft kaydet (server-side, admin auth zaten kontrol edildi).
 */
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
      draft_config: draft,
      draft_updated_at: new Date().toISOString(),
      draft_updated_by: adminId,
      draft_updated_by_email: adminEmail,
    } as never)
    .eq("scope", scope);
  if (error) return { ok: false, error: error.message };

  // History entry
  await admin.from("pricing_config_history").insert([
    {
      scope,
      action: "draft_save",
      config_snapshot: draft,
      changed_by: adminId,
      changed_by_email: adminEmail,
      note: note ?? null,
    },
  ] as never);

  return { ok: true };
}

/**
 * Draft → Live (RPC ile, audit log dahil).
 */
export async function publishPricingConfig(
  scope: ScopeName,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "fn_publish_pricing_config" as never,
    { p_scope: scope, p_note: note ?? null } as never
  );
  if (error) return { ok: false, error: error.message };
  invalidatePricingCache(scope);
  return { ok: true };
}

/**
 * History snapshot'ına geri dön (live'i değiştirir).
 */
export async function revertPricingConfig(
  scope: ScopeName,
  historyId: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "fn_revert_pricing_config" as never,
    { p_scope: scope, p_history_id: historyId } as never
  );
  if (error) return { ok: false, error: error.message };
  invalidatePricingCache(scope);
  return { ok: true };
}

/**
 * History listesi (son 30 değişiklik).
 */
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
  if (scope === "sticker") return FALLBACK_STICKER_CONFIG;
  if (scope === "etiket") return FALLBACK_ETIKET_CONFIG;
  return {};
}
