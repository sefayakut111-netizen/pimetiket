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
  /** Sticker + Rulo Etiket için: ₺/m² maliyet */
  m2_cost_try?: number;
  /** Tabaka Etiket için: ₺/tabaka maliyet (23×31 cm 1 tabaka) */
  sheet_cost_try?: number;
  desc?: string;
}

export interface OptionItem {
  id: string;
  name: string;
  pct_add: number;
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
  setup: number;
  packaging_per_unit: number;
  cargo: number;
  fee_pct: number;
}

export interface PercentConfig {
  pct: number;
}

export type PricingMode = "area" | "sheet";

export interface ProfileConfig {
  /** "area" → m2_cost × area × qty (sticker, rulo etiket)
   *  "sheet" → sheet_cost × sheets_needed (tabaka etiket)
   *  Default: "area" (geriye uyum) */
  pricing_mode?: PricingMode;
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
// FALLBACK Defaults
// ============================================================

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
    { id: "kuse",  name: "Kuşe Etiket",    sheet_cost_try: 22, desc: "Mat kaplamalı baskı kağıdı (23×31 cm)" },
    { id: "kraft", name: "Kraft Etiket",   sheet_cost_try: 20, desc: "Doğal, dokunsal (23×31 cm)" },
    { id: "beyaz", name: "Opak PP Etiket", sheet_cost_try: 27, desc: "Klasik, dayanıklı, parlak (23×31 cm)" },
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
