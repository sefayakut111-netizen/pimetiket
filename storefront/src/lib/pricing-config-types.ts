/**
 * Pricing Config Types + Fallback constants
 *
 * Client-safe — server-only kod (createAdminClient) yok.
 * Server tarafı için `pricing-config.ts` kullan.
 */

export type ScopeName =
  | "sticker"
  | "etiket_rulo"
  | "etiket_tabaka"
  | "global";

export interface MaterialItem {
  id: string;
  name: string;
  /** Sticker + Rulo Etiket için: ₺/m² alış (partner/maliyet) */
  m2_cost_try?: number;
  /** Sticker için: ₺/m² satış (müşteri) */
  m2_sell_try?: number;
  /** Tabaka Etiket için: ₺/tabaka alış (23×31 cm 1 tabaka) */
  sheet_cost_try?: number;
  /** Tabaka için: ₺/tabaka satış (sticker dışı gelecek kullanım) */
  sheet_sell_try?: number;
  desc?: string;
  /** Rakip referans notu — hesaba girmez, bilgi amaçlı */
  competitor_ref?: string;
  /** false = müşteri tarafında gizli (undefined = aktif) */
  active?: boolean;
}

export interface OptionItem {
  id: string;
  name: string;
  /** Müşteri satış yüzdesi */
  pct_add: number;
  /** Maliyet/alış yüzdesi — yoksa pct_add × 0.5 */
  pct_cost?: number;
  desc?: string;
}

export interface OptionGroup {
  label: string;
  required?: boolean;
  single_select: boolean;
  items: OptionItem[];
}

export interface TierConfig {
  qty: number;
  multiplier: number;
  label: string;
}

export interface OperationConfig {
  enabled?: boolean;
  setup: number;
  packaging_per_unit: number;
  /** Etiket legacy — sticker dual-price profillerinde kullanılmaz */
  cargo?: number;
  fee_pct: number;
}

export interface PercentConfig {
  pct: number;
}

export interface CutMultipliers {
  diecut: number;
  kisscut: number;
  tabaka: number;
}

export type PricingMode = "area" | "sheet" | "pricebook";

export interface ProfileConfig {
  /** "area" → m2_cost × area × qty (sticker, rulo etiket legacy)
   *  "sheet" → sheet_cost × sheets_needed (tabaka etiket)
   *  "pricebook" → partner WxH×qty matris (rulo etiket)
   *  Default: "area" (geriye uyum) */
  pricing_mode?: PricingMode;
  materials: MaterialItem[];
  options: Record<string, OptionGroup>;
  tiers: TierConfig[];
  operation: OperationConfig;
  /** Etiket legacy — sticker dual-price profillerinde yok */
  margin?: PercentConfig;
  vat: PercentConfig;
  /** Sticker: kesim türü fiyat çarpanı (diecut/kisscut/tabaka). Yoksa hepsi 1.0. */
  cut_multipliers?: CutMultipliers;
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
// FALLBACK Defaults
// ============================================================

/** v_pricing_live (2026-06) ile senkron — son savunma; checkout sessiz fallback kullanmaz. */
export const FALLBACK_STICKER_CONFIG: ProfileConfig = {
  materials: [
    { id: "vinil",      name: "Opak Folyo",         m2_cost_try: 400,  m2_sell_try: 650,  desc: "Standart parlak opak folyo, açıkhava dayanımlı" },
    { id: "transparan", name: "Şeffaf Folyo",       m2_cost_try: 500,  m2_sell_try: 800,  desc: "Şeffaf, cam üstü görünmez efekt" },
    { id: "holo",       name: "Hologram Folyo",     m2_cost_try: 600,  m2_sell_try: 1000, desc: "Yansıtıcı, prizmatik efekt" },
    { id: "simli",      name: "Simli Hologram Folyo", m2_cost_try: 700, m2_sell_try: 1250, desc: "Metalik gümüş/altın parıltı" },
  ],
  options: {
    finish: {
      label: "Laminasyon",
      required: true,
      single_select: true,
      items: [
        { id: "yok",    name: "Yok",    pct_cost: 0, pct_add: 0 },
        { id: "parlak", name: "Parlak", pct_cost: 0, pct_add: 0 },
        { id: "mat",    name: "Mat",    pct_cost: 5, pct_add: 10 },
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
  operation: { setup: 50, packaging_per_unit: 0.01, fee_pct: 2.5 },
  vat: { pct: 20 },
  cut_multipliers: { diecut: 1.10, kisscut: 1.00, tabaka: 1.00 },
};

export const FALLBACK_ETIKET_RULO_CONFIG: ProfileConfig = {
  pricing_mode: "pricebook",
  materials: [
    { id: "kuse",    name: "Kuşe Etiket",    m2_cost_try: 350, desc: "Mat kaplamalı baskı kağıdı" },
    { id: "kraft",   name: "Kraft Etiket",   m2_cost_try: 300, desc: "Doğal, dokunsal" },
    { id: "beyaz",   name: "Opak PP Etiket", m2_cost_try: 400, desc: "Klasik, dayanıklı, parlak" },
    { id: "seffaf",  name: "Şeffaf Etiket",  m2_cost_try: 600, desc: "Arka planı gösteren saydam etiket" },
    { id: "ultra",   name: "Ultra Clear Etiket", m2_cost_try: 600, desc: "Tamamen şeffaf, görünmez film" },
    { id: "metalik", name: "Metalize Etiket", m2_cost_try: 900, desc: "Parlak metalik yüzey" },
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
    { qty: 15000, multiplier: 0.92, label: "-%8 indirim" },
    { qty: 20000, multiplier: 0.90, label: "-%10 indirim" },
    { qty: 25000, multiplier: 0.88, label: "-%12 indirim" },
  ],
  operation: { setup: 80, packaging_per_unit: 0.015, cargo: 80, fee_pct: 2.5 },
  margin: { pct: 50 },
  vat: { pct: 20 },
};

// Sefa 17 May v7: Tabaka etikette m² mantığı YOK — 1 tabaka belirli fiyat.
// Hesap: sheet_cost × sheets_needed (kaç tabaka basılacak)
export const FALLBACK_ETIKET_TABAKA_CONFIG: ProfileConfig = {
  pricing_mode: "sheet",
  materials: [
    { id: "kuse",  name: "Kuşe Etiket",    sheet_cost_try: 22, sheet_sell_try: 33, desc: "Mat kaplamalı baskı kağıdı (33×45 cm)" },
    { id: "kraft", name: "Kraft Etiket",   sheet_cost_try: 20, sheet_sell_try: 30, desc: "Doğal, dokunsal (33×45 cm)" },
    { id: "beyaz", name: "Opak PP Etiket", sheet_cost_try: 27, sheet_sell_try: 40, desc: "Klasik, dayanıklı, parlak (33×45 cm)" },
  ],
  options: {
    coating: {
      label: "Kaplama",
      required: true,
      single_select: true,
      items: [
        { id: "yok",    name: "Kaplamasız",     pct_cost: 0,  pct_add: 0 },
        { id: "mat",    name: "Mat selefon",    pct_cost: 8,  pct_add: 15 },
        { id: "parlak", name: "Parlak selefon", pct_cost: 8,  pct_add: 15 },
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
  operation: { setup: 60, packaging_per_unit: 0.02, fee_pct: 2.5 },
  vat: { pct: 20 },
};
