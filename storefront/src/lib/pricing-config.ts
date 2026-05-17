/**
 * Pricing Config — DB-bağlı fiyat yönetimi (Migration 047 + 048).
 *
 * v2 (Migration 048): m² maliyet + toplamsal % yapısı + 3 profil:
 *   - sticker
 *   - etiket_rulo
 *   - etiket_tabaka
 *   - global (ileride)
 *
 * Her profil:
 *   - materials[]:  { id, name, m2_cost_try, desc }
 *   - options:      { groupId: { label, single_select, items[] } }
 *   - tiers[]:      adet kademesi (çarpansal)
 *   - operation:    setup/packaging/cargo/fee%
 *   - margin/vat:   yüzde
 */

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Types
// ============================================================

export type ScopeName =
  | "sticker"
  | "etiket_rulo"
  | "etiket_tabaka"
  | "global";

export interface MaterialItem {
  id: string;
  name: string;
  /** TL/m² maliyet — Sefa girer (atölye tarifesi) */
  m2_cost_try: number;
  desc?: string;
}

export interface OptionItem {
  id: string;
  name: string;
  /** Toplamsal yüzde ekleme (ana fiyat üzerinden) */
  pct_add: number;
  desc?: string;
}

export interface OptionGroup {
  label: string;
  required?: boolean;
  /** true ise tek seçim, false ise multi-select */
  single_select: boolean;
  items: OptionItem[];
}

export interface TierConfig {
  qty: number;
  /** Çarpansal — referans=1.0, az adet >1.0 (zam), çok adet <1.0 (indirim) */
  multiplier: number;
  label: string;
}

export interface OperationConfig {
  setup: number;
  packaging_per_unit: number;
  cargo: number;
  fee_pct: number;
}

export interface PercentConfig {
  pct: number;
}

export interface ProfileConfig {
  materials: MaterialItem[];
  options: Record<string, OptionGroup>;
  tiers: TierConfig[];
  operation: OperationConfig;
  margin: PercentConfig;
  vat: PercentConfig;
}

export type ScopeConfig = ProfileConfig | Record<string, unknown>;

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
// Fallback defaults (DB unreachable senaryosu)
// ============================================================

// Sefa 17 May v3: ID'ler konfigüratör sayfalarıyla birebir eşleşir
// (src/app/sticker/page.tsx MATERIAL_IDS = ["vinil", "transparan", "holo", "simli"])
export const FALLBACK_STICKER_CONFIG: ProfileConfig = {
  materials: [
    { id: "vinil",      name: "Vinil",      m2_cost_try: 500,  desc: "Standart parlak vinil, açıkhava dayanımlı" },
    { id: "transparan", name: "Transparan", m2_cost_try: 700,  desc: "Şeffaf, cam üstü görünmez efekt" },
    { id: "holo",       name: "Holografik", m2_cost_try: 1200, desc: "Yansıtıcı, prizmatik efekt" },
    { id: "simli",      name: "Simli",      m2_cost_try: 1500, desc: "Metalik gümüş/altın parıltı" },
  ],
  options: {
    finish: {
      label: "Finiş",
      required: true,
      single_select: true,
      items: [
        { id: "yok",    name: "Yok",    pct_add: 0 },
        { id: "parlak", name: "Parlak", pct_add: 0 },
        { id: "mat",    name: "Mat",    pct_add: 10 },
      ],
    },
  },
  tiers: [
    { qty: 25, multiplier: 1.30, label: "+%30 zam" },
    { qty: 50, multiplier: 1.20, label: "+%20 zam" },
    { qty: 100, multiplier: 1.10, label: "+%10 zam" },
    { qty: 250, multiplier: 1.00, label: "referans" },
    { qty: 500, multiplier: 0.90, label: "-%10 indirim" },
    { qty: 1000, multiplier: 0.80, label: "-%20 indirim" },
  ],
  operation: { setup: 50, packaging_per_unit: 0.01, cargo: 80, fee_pct: 2.5 },
  margin: { pct: 50 },
  vat: { pct: 20 },
};

// Sefa 17 May v3: ID'ler etiket konfigüratörüyle eşleşir
// (kuse/kraft/beyaz/ultra/metalik, beyaz name="Opak PP Etiket")
export const FALLBACK_ETIKET_RULO_CONFIG: ProfileConfig = {
  materials: [
    { id: "kuse",    name: "Kuşe Etiket",    m2_cost_try: 350, desc: "Mat kaplamalı baskı kağıdı" },
    { id: "kraft",   name: "Kraft Etiket",   m2_cost_try: 300, desc: "Doğal, dokunsal" },
    { id: "beyaz",   name: "Opak PP Etiket", m2_cost_try: 400, desc: "Klasik, dayanıklı, parlak" },
    { id: "ultra",   name: "Ultra clear",    m2_cost_try: 600, desc: "Şeffaf cam etkisi" },
    { id: "metalik", name: "Metalik",        m2_cost_try: 900, desc: "Folyo gümüş" },
  ],
  options: {
    coating: {
      label: "Kaplama",
      required: true,
      single_select: true,
      items: [
        { id: "yok",    name: "Kaplamasız",     pct_add: 0 },
        { id: "mat",    name: "Mat selefon",    pct_add: 15 },
        { id: "parlak", name: "Parlak selefon", pct_add: 15 },
        { id: "soft",   name: "Soft touch",     pct_add: 30 },
      ],
    },
    customization: {
      label: "Özelleştirme",
      required: false,
      single_select: false,
      items: [
        { id: "yok",    name: "Özelleştirme yok",  pct_add: 0 },
        { id: "emboss", name: "Kabartma (emboss)", pct_add: 30 },
        { id: "yaldiz", name: "Sıcak yaldız",      pct_add: 50 },
        { id: "spotuv", name: "Spot UV",           pct_add: 25 },
      ],
    },
  },
  tiers: [
    { qty: 1000, multiplier: 1.10, label: "+%10 zam" },
    { qty: 2000, multiplier: 1.05, label: "+%5 zam" },
    { qty: 5000, multiplier: 1.00, label: "referans" },
    { qty: 10000, multiplier: 0.95, label: "-%5 indirim" },
    { qty: 20000, multiplier: 0.90, label: "-%10 indirim" },
    { qty: 50000, multiplier: 0.82, label: "-%18 indirim" },
  ],
  operation: { setup: 80, packaging_per_unit: 0.015, cargo: 80, fee_pct: 2.5 },
  margin: { pct: 50 },
  vat: { pct: 20 },
};

export const FALLBACK_ETIKET_TABAKA_CONFIG: ProfileConfig = {
  materials: [
    { id: "kuse",  name: "Kuşe Etiket",    m2_cost_try: 320, desc: "Mat kaplamalı baskı kağıdı" },
    { id: "kraft", name: "Kraft Etiket",   m2_cost_try: 280, desc: "Doğal, dokunsal" },
    { id: "beyaz", name: "Opak PP Etiket", m2_cost_try: 380, desc: "Klasik, dayanıklı, parlak" },
  ],
  options: {
    coating: {
      label: "Kaplama",
      required: true,
      single_select: true,
      items: [
        { id: "yok",    name: "Kaplamasız",     pct_add: 0 },
        { id: "mat",    name: "Mat selefon",    pct_add: 15 },
        { id: "parlak", name: "Parlak selefon", pct_add: 15 },
      ],
    },
  },
  tiers: [
    { qty: 250, multiplier: 1.15, label: "+%15 zam" },
    { qty: 500, multiplier: 1.08, label: "+%8 zam" },
    { qty: 1000, multiplier: 1.00, label: "referans" },
    { qty: 2500, multiplier: 0.95, label: "-%5 indirim" },
    { qty: 5000, multiplier: 0.90, label: "-%10 indirim" },
    { qty: 10000, multiplier: 0.85, label: "-%15 indirim" },
  ],
  operation: { setup: 60, packaging_per_unit: 0.02, cargo: 80, fee_pct: 2.5 },
  margin: { pct: 50 },
  vat: { pct: 20 },
};

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
      draft_config: draft,
      draft_updated_at: new Date().toISOString(),
      draft_updated_by: adminId,
      draft_updated_by_email: adminEmail,
    } as never)
    .eq("scope", scope);
  if (error) return { ok: false, error: error.message };

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
