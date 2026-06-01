/**
 * Retail katmani — modifier + markup + operasyon + fee + KDV.
 *
 * Price book ham birim fiyatindan musteri fiyatina gecis.
 * Sticker/rulo/tabaka ortak fee/KDV mantigi.
 */

import type { ProfileConfig, OptionItem } from "./pricing-config-types";

export interface RetailLayerInput {
  qty: number;
  /** Partner ham birim fiyat (TL/adet) veya tabaka/sticker baz maliyet */
  base_subtotal: number;
  selected_options: Record<string, string | string[] | undefined>;
  /** Price book modunda tier uygulanmaz */
  skip_tier?: boolean;
  /** Global markup — price book modunda config.margin yerine veya uzerine */
  markup_pct_override?: number;
}

export interface RetailLayerResult {
  options_pct_total: number;
  with_options: number;
  operation_cost: number;
  cost_total: number;
  markup_pct: number;
  with_markup: number;
  with_fee: number;
  final: number;
  unit_price: number;
  selected_options_detail: Array<{
    group_id: string;
    group_label: string;
    item_id: string;
    item_name: string;
    pct_add: number;
  }>;
}

function collectOptions(
  config: ProfileConfig,
  selected_options: Record<string, string | string[] | undefined>
): {
  options_pct_total: number;
  selected_options_detail: RetailLayerResult["selected_options_detail"];
} {
  let options_pct_total = 0;
  const selected_options_detail: RetailLayerResult["selected_options_detail"] =
    [];

  for (const [group_id, group] of Object.entries(config.options)) {
    const selected = selected_options[group_id];
    if (!selected) continue;

    if (group.single_select) {
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
      const ids = Array.isArray(selected) ? selected : [];
      for (const id of ids) {
        const item = group.items.find((i: OptionItem) => i.id === id);
        if (item && item.id !== "yok") {
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

  return { options_pct_total, selected_options_detail };
}

export function applyRetailLayer(
  input: RetailLayerInput,
  config: ProfileConfig
): RetailLayerResult {
  const { options_pct_total, selected_options_detail } = collectOptions(
    config,
    input.selected_options
  );

  const with_options = input.base_subtotal * (1 + options_pct_total / 100);
  const op = config.operation;
  const operation_cost =
    op.setup + op.packaging_per_unit * input.qty + (op.cargo ?? 0);
  const cost_total = with_options + operation_cost;

  const markup_pct =
    input.markup_pct_override ?? config.margin?.pct ?? 0;
  const with_markup = cost_total * (1 + markup_pct / 100);

  const fee_pct = op.fee_pct ?? 0;
  const with_fee =
    fee_pct > 0 && fee_pct < 100
      ? with_markup / (1 - fee_pct / 100)
      : with_markup;
  const final = with_fee * (1 + config.vat.pct / 100);
  const unit_price = final / input.qty;

  return {
    options_pct_total,
    with_options,
    operation_cost,
    cost_total,
    markup_pct,
    with_markup,
    with_fee,
    final,
    unit_price,
    selected_options_detail,
  };
}
