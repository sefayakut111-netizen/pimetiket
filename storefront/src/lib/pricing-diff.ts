/**
 * Pricing Config Diff Helper
 *
 * Sefa 17 May: "kaydedildi nezaman güzel mantık".
 *
 * İki ProfileConfig arası farkları okunabilir string array olarak döner.
 * Sefa "ne değişti?" sorusunu görsel bir liste ile cevaplar.
 *
 * Örnek output:
 *   - "Vinil m² maliyet: 500 → 600 ₺"
 *   - "Mat finiş %: +10% → +15%"
 *   - "Margin: 50% → 55%"
 *   - "Tier 250 adet çarpan: 1.00 → 0.95"
 */

import type { ProfileConfig, ScopeConfig, ScopeName } from "./pricing-config";
import { isStickerDualPriceScope } from "./pricing-dual-price";

export interface DiffEntry {
  section: "materials" | "options" | "tiers" | "operation" | "margin" | "vat";
  label: string;
  old_value: string | number;
  new_value: string | number;
}

function isProfileConfig(c: ScopeConfig): c is ProfileConfig {
  return !!c && typeof c === "object" && "materials" in c && "tiers" in c;
}

/**
 * old → new arası farkları döner. Aynıysa boş array.
 */
export function diffProfileConfig(
  oldCfg: ScopeConfig,
  newCfg: ScopeConfig,
  scope?: ScopeName
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  if (!isProfileConfig(oldCfg) || !isProfileConfig(newCfg)) return diffs;

  const dualSticker = isStickerDualPriceScope(scope);

  // Materials — sheet mode için sheet_cost_try, area mode için m2_cost_try
  const isSheetMode = newCfg.pricing_mode === "sheet" || oldCfg.pricing_mode === "sheet";
  const costUnit = isSheetMode ? "₺/tabaka" : "₺/m²";
  const costLabel = isSheetMode ? "tabaka maliyet" : "m² maliyet";
  const getCost = (m: { m2_cost_try?: number; sheet_cost_try?: number }): number | undefined =>
    isSheetMode ? m.sheet_cost_try : m.m2_cost_try;
  const getSell = (m: { m2_sell_try?: number; sheet_sell_try?: number }): number | undefined =>
    isSheetMode ? m.sheet_sell_try : m.m2_sell_try;

  for (const oldMat of oldCfg.materials) {
    const newMat = newCfg.materials.find((m) => m.id === oldMat.id);
    if (!newMat) {
      diffs.push({
        section: "materials",
        label: `Malzeme "${oldMat.name}" KALDIRILDI`,
        old_value: `${getCost(oldMat) ?? "?"} ${costUnit}`,
        new_value: "-",
      });
      continue;
    }
    const oldCost = getCost(oldMat);
    const newCost = getCost(newMat);
    if (oldCost !== newCost) {
      diffs.push({
        section: "materials",
        label: `${newMat.name} ${costLabel}`,
        old_value: `${oldCost ?? "?"} ₺`,
        new_value: `${newCost ?? "?"} ₺`,
      });
    }
    if (dualSticker) {
      const oldSell = getSell(oldMat);
      const newSell = getSell(newMat);
      if (oldSell !== newSell) {
        diffs.push({
          section: "materials",
          label: `${newMat.name} m² satış`,
          old_value: `${oldSell ?? "?"} ₺`,
          new_value: `${newSell ?? "?"} ₺`,
        });
      }
    }
    if (oldMat.name !== newMat.name) {
      diffs.push({
        section: "materials",
        label: `${oldMat.id} ad`,
        old_value: oldMat.name,
        new_value: newMat.name,
      });
    }
  }
  // Yeni eklenen malzemeler
  for (const newMat of newCfg.materials) {
    if (!oldCfg.materials.find((m) => m.id === newMat.id)) {
      diffs.push({
        section: "materials",
        label: `Malzeme "${newMat.name}" EKLENDI`,
        old_value: "-",
        new_value: `${getCost(newMat) ?? "?"} ${costUnit}`,
      });
    }
  }

  // Options
  for (const [groupId, oldGroup] of Object.entries(oldCfg.options)) {
    const newGroup = newCfg.options[groupId];
    if (!newGroup) {
      diffs.push({
        section: "options",
        label: `Grup "${oldGroup.label}" KALDIRILDI`,
        old_value: `${oldGroup.items.length} seçenek`,
        new_value: "-",
      });
      continue;
    }
    for (const oldItem of oldGroup.items) {
      const newItem = newGroup.items.find((i) => i.id === oldItem.id);
      if (!newItem) {
        diffs.push({
          section: "options",
          label: `${oldGroup.label} → "${oldItem.name}" KALDIRILDI`,
          old_value: `+%${oldItem.pct_add}`,
          new_value: "-",
        });
        continue;
      }
      if (oldItem.pct_add !== newItem.pct_add) {
        diffs.push({
          section: "options",
          label: `${newGroup.label} → ${newItem.name} satış %`,
          old_value: `+%${oldItem.pct_add}`,
          new_value: `+%${newItem.pct_add}`,
        });
      }
      if (dualSticker && oldItem.pct_cost !== newItem.pct_cost) {
        diffs.push({
          section: "options",
          label: `${newGroup.label} → ${newItem.name} maliyet %`,
          old_value: `+%${oldItem.pct_cost ?? "?"}`,
          new_value: `+%${newItem.pct_cost ?? "?"}`,
        });
      }
      if (oldItem.name !== newItem.name) {
        diffs.push({
          section: "options",
          label: `${oldGroup.label} → ${oldItem.id} ad`,
          old_value: oldItem.name,
          new_value: newItem.name,
        });
      }
    }
    for (const newItem of newGroup.items) {
      if (!oldGroup.items.find((i) => i.id === newItem.id)) {
        diffs.push({
          section: "options",
          label: `${newGroup.label} → "${newItem.name}" EKLENDI`,
          old_value: "-",
          new_value: `+%${newItem.pct_add}`,
        });
      }
    }
  }

  // Tiers
  if (oldCfg.tiers.length === newCfg.tiers.length) {
    for (let i = 0; i < oldCfg.tiers.length; i++) {
      const oldT = oldCfg.tiers[i];
      const newT = newCfg.tiers[i];
      if (oldT.qty !== newT.qty || oldT.multiplier !== newT.multiplier) {
        diffs.push({
          section: "tiers",
          label: `Tier ${newT.qty} adet`,
          old_value: `×${oldT.multiplier}`,
          new_value: `×${newT.multiplier}`,
        });
      }
    }
  } else {
    diffs.push({
      section: "tiers",
      label: "Tier sayısı",
      old_value: `${oldCfg.tiers.length} satır`,
      new_value: `${newCfg.tiers.length} satır`,
    });
  }

  // Operation — enabled toggle
  if ((oldCfg.operation.enabled !== false) !== (newCfg.operation.enabled !== false)) {
    diffs.push({
      section: "operation",
      label: "Operasyon aktif",
      old_value: oldCfg.operation.enabled !== false ? 1 : 0,
      new_value: newCfg.operation.enabled !== false ? 1 : 0,
    });
  }
  // Operation — numeric fields
  const op_num_keys = dualSticker
    ? (["setup", "packaging_per_unit", "fee_pct"] as const)
    : (["setup", "packaging_per_unit", "cargo", "fee_pct"] as const);
  const op_labels: Record<string, string> = {
    setup: "Setup",
    packaging_per_unit: "Paketleme/adet",
    cargo: "Kargo",
    fee_pct: "Komisyon %",
  };
  for (const k of op_num_keys) {
    const oldVal = oldCfg.operation[k];
    const newVal = newCfg.operation[k];
    if (oldVal !== newVal) {
      diffs.push({
        section: "operation",
        label: op_labels[k],
        old_value: oldVal ?? "-",
        new_value: newVal ?? "-",
      });
    }
  }

  // Margin — yalnızca etiket legacy
  if (
    !dualSticker &&
    oldCfg.margin?.pct !== undefined &&
    newCfg.margin?.pct !== undefined &&
    oldCfg.margin.pct !== newCfg.margin.pct
  ) {
    diffs.push({
      section: "margin",
      label: "Kâr marjı",
      old_value: `%${oldCfg.margin.pct}`,
      new_value: `%${newCfg.margin.pct}`,
    });
  } else if (
    !dualSticker &&
    (oldCfg.margin?.pct ?? null) !== (newCfg.margin?.pct ?? null)
  ) {
    diffs.push({
      section: "margin",
      label: "Kâr marjı",
      old_value: oldCfg.margin ? `%${oldCfg.margin.pct}` : "-",
      new_value: newCfg.margin ? `%${newCfg.margin.pct}` : "-",
    });
  }

  // VAT
  if (oldCfg.vat.pct !== newCfg.vat.pct) {
    diffs.push({
      section: "vat",
      label: "KDV",
      old_value: `%${oldCfg.vat.pct}`,
      new_value: `%${newCfg.vat.pct}`,
    });
  }

  return diffs;
}

/**
 * Tek satır material/option DEĞİŞTİ mi kontrolü — UI'da "değişti" rozet için.
 */
export function isMaterialChanged(
  liveCfg: ScopeConfig,
  draftCfg: ScopeConfig,
  materialId: string
): boolean {
  if (!isProfileConfig(liveCfg) || !isProfileConfig(draftCfg)) return false;
  const live = liveCfg.materials.find((m) => m.id === materialId);
  const draft = draftCfg.materials.find((m) => m.id === materialId);
  if (!live || !draft) return true;
  return (
    live.m2_cost_try !== draft.m2_cost_try ||
    live.m2_sell_try !== draft.m2_sell_try ||
    live.sheet_cost_try !== draft.sheet_cost_try ||
    live.sheet_sell_try !== draft.sheet_sell_try ||
    live.name !== draft.name ||
    (live.desc ?? "") !== (draft.desc ?? "")
  );
}

export function isOptionChanged(
  liveCfg: ScopeConfig,
  draftCfg: ScopeConfig,
  groupId: string,
  itemId: string
): boolean {
  if (!isProfileConfig(liveCfg) || !isProfileConfig(draftCfg)) return false;
  const liveItem = liveCfg.options[groupId]?.items.find((i) => i.id === itemId);
  const draftItem = draftCfg.options[groupId]?.items.find((i) => i.id === itemId);
  if (!liveItem || !draftItem) return true;
  return (
    liveItem.pct_add !== draftItem.pct_add ||
    liveItem.pct_cost !== draftItem.pct_cost ||
    liveItem.name !== draftItem.name
  );
}

export function isTierChanged(
  liveCfg: ScopeConfig,
  draftCfg: ScopeConfig,
  idx: number
): boolean {
  if (!isProfileConfig(liveCfg) || !isProfileConfig(draftCfg)) return false;
  const liveT = liveCfg.tiers[idx];
  const draftT = draftCfg.tiers[idx];
  if (!liveT || !draftT) return true;
  return (
    liveT.qty !== draftT.qty ||
    liveT.multiplier !== draftT.multiplier ||
    liveT.label !== draftT.label
  );
}
