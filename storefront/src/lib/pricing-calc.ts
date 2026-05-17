/**
 * Pricing Calculator — Jenerik fiyat hesaplama (3 profil ortak).
 *
 * Sefa 17 May v2: m² maliyet + toplamsal % + tier çarpansal.
 *
 * Formül:
 *   area_m2  = (width × height) / 1.000.000
 *   base     = m2_cost × area × qty
 *   tiered   = base × tier_multiplier
 *   with_opt = tiered × (1 + Σ option_pct / 100)
 *   + op     = (setup + packaging × qty + cargo)
 *   + margin = × (1 + margin% / 100)
 *   / fee    = / (1 - fee% / 100)   ← gross-up
 *   + KDV    = × (1 + vat% / 100)
 */

import type {
  ProfileConfig,
  MaterialItem,
  OptionItem,
  TierConfig,
} from "./pricing-config-types";

// ============================================================
// Input / Output
// ============================================================

export interface PriceCalcInput {
  width_mm: number;
  height_mm: number;
  qty: number;
  material_id: string;
  /** Map of group_id → selected option(s). Single: string, Multi: string[] */
  selected_options: Record<string, string | string[] | undefined>;
}

export interface PriceCalcOk {
  ok: true;
  // Adım adım değerler
  area_m2: number;
  material: MaterialItem;
  tier: TierConfig;
  base: number;
  tiered: number;
  options_pct_total: number;
  selected_options_detail: Array<{
    group_id: string;
    group_label: string;
    item_id: string;
    item_name: string;
    pct_add: number;
  }>;
  with_options: number;
  operation_cost: number;
  cost_total: number;
  with_margin: number;
  with_fee: number;
  total_with_vat: number;
  /** Müşteri görür */
  final: number;
  /** Birim fiyat (final / qty) */
  unit_price: number;
}

export interface PriceCalcFail {
  ok: false;
  reason: string;
  hint?: string;
}

export type PriceCalcResult = PriceCalcOk | PriceCalcFail;

// ============================================================
// Helpers
// ============================================================

/**
 * Adet için uygun tier'ı bul. Tier listesi qty'ye göre artan sırada
 * varsayılır. Verilen qty hangi qty eşiğine eşit veya altındaysa o tier.
 *
 * Örnek: tiers = [25, 50, 100, 250, 500, 1000], qty=300 → tier 500.
 * En düşük qty < tier yok → en düşük tier.
 */
export function findTier(qty: number, tiers: TierConfig[]): TierConfig {
  const sorted = [...tiers].sort((a, b) => a.qty - b.qty);
  // qty bir tier'a eşitse o tier
  for (const t of sorted) {
    if (qty <= t.qty) return t;
  }
  // qty en büyük tier'dan da büyükse, en büyüğü kullan
  return sorted[sorted.length - 1] ?? { qty: 1, multiplier: 1, label: "default" };
}

// ============================================================
// Main calculate
// ============================================================

export function calculatePrice(
  input: PriceCalcInput,
  config: ProfileConfig
): PriceCalcResult {
  // 1. Material bul
  const material = config.materials.find((m) => m.id === input.material_id);
  if (!material) {
    return {
      ok: false,
      reason: "material_not_found",
      hint: `Material id "${input.material_id}" bu profilde tanımlı değil`,
    };
  }

  // 2. Validation
  if (input.width_mm <= 0 || input.height_mm <= 0) {
    return { ok: false, reason: "invalid_size" };
  }
  if (input.qty <= 0) {
    return { ok: false, reason: "invalid_qty" };
  }

  // 3. Area m²
  const area_m2 = (input.width_mm * input.height_mm) / 1_000_000;

  // 4. Base = m2_cost × area × qty
  const base = material.m2_cost_try * area_m2 * input.qty;

  // 5. Tier (çarpansal)
  const tier = findTier(input.qty, config.tiers);
  const tiered = base * tier.multiplier;

  // 6. Options (toplamsal %) — her grup için
  let options_pct_total = 0;
  const selected_options_detail: PriceCalcOk["selected_options_detail"] = [];

  for (const [group_id, group] of Object.entries(config.options)) {
    const selected = input.selected_options[group_id];

    // Required check
    if (group.required && !selected) {
      return {
        ok: false,
        reason: `option_required:${group_id}`,
        hint: `${group.label} seçilmeli`,
      };
    }
    if (!selected) continue;

    if (group.single_select) {
      // Single: string bekleniyor
      const id = typeof selected === "string" ? selected : null;
      if (!id) continue;
      const item = group.items.find((i: OptionItem) => i.id === id);
      if (item) {
        options_pct_total += item.pct_add;
        selected_options_detail.push({
          group_id,
          group_label: group.label,
          item_id: item.id,
          item_name: item.name,
          pct_add: item.pct_add,
        });
      }
    } else {
      // Multi: string[] bekleniyor
      const ids = Array.isArray(selected) ? selected : [];
      for (const id of ids) {
        const item = group.items.find((i: OptionItem) => i.id === id);
        if (item) {
          options_pct_total += item.pct_add;
          selected_options_detail.push({
            group_id,
            group_label: group.label,
            item_id: item.id,
            item_name: item.name,
            pct_add: item.pct_add,
          });
        }
      }
    }
  }

  const with_options = tiered * (1 + options_pct_total / 100);

  // 7. Operation cost
  const op = config.operation;
  const operation_cost =
    op.setup + op.packaging_per_unit * input.qty + op.cargo;
  const cost_total = with_options + operation_cost;

  // 8. Margin
  const with_margin = cost_total * (1 + config.margin.pct / 100);

  // 9. Fee gross-up (PayTR komisyonu müşteriye binsin)
  const fee_pct = op.fee_pct ?? 0;
  const with_fee = with_margin / (1 - fee_pct / 100);

  // 10. KDV
  const final = with_fee * (1 + config.vat.pct / 100);
  const unit_price = final / input.qty;

  return {
    ok: true,
    area_m2,
    material,
    tier,
    base,
    tiered,
    options_pct_total,
    selected_options_detail,
    with_options,
    operation_cost,
    cost_total,
    with_margin,
    with_fee,
    total_with_vat: final,
    final,
    unit_price,
  };
}

// ============================================================
// Helper: Scope adı türetme (formFactor → scope)
// ============================================================

/**
 * Müşteri sayfasında "etiket" + formFactor seçilince hangi DB scope?
 */
export function deriveScopeFromProduct(
  product: "sticker" | "etiket",
  formFactor?: "rulo" | "tabaka"
): "sticker" | "etiket_rulo" | "etiket_tabaka" {
  if (product === "sticker") return "sticker";
  if (formFactor === "tabaka") return "etiket_tabaka";
  return "etiket_rulo";
}
