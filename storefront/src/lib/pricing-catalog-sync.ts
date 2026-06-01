/**
 * Pricing catalog sync — admin config'i konfigüratör katalog listeleriyle eşle.
 *
 * Müşteri tarafı (sticker/etiket yapilandir) eksik admin id'lerini graceful
 * fallback ile tamamlar; admin /fiyatlar ise DB'deki draft/live'ı olduğu gibi
 * gösterir. Bu modül eksik malzeme/seçenekleri FALLBACK profilden ekler.
 */

import type { ProfileConfig, ScopeName } from "./pricing-config-types";
import {
  FALLBACK_STICKER_CONFIG,
  FALLBACK_ETIKET_RULO_CONFIG,
  FALLBACK_ETIKET_TABAKA_CONFIG,
} from "./pricing-config-types";

export interface CatalogSyncResult {
  config: ProfileConfig;
  /** Eklenen öğe anahtarları: material:seffaf, option:finish:mat */
  added: string[];
}

function catalogForScope(scope: ScopeName): ProfileConfig | null {
  switch (scope) {
    case "sticker":
      return FALLBACK_STICKER_CONFIG;
    case "etiket_rulo":
      return FALLBACK_ETIKET_RULO_CONFIG;
    case "etiket_tabaka":
      return FALLBACK_ETIKET_TABAKA_CONFIG;
    default:
      return null;
  }
}

/** Eksik malzeme/seçenekleri katalog fallback'inden sona ekle (mevcut sıra korunur). */
export function mergePricingCatalog(
  scope: ScopeName,
  config: ProfileConfig
): CatalogSyncResult {
  const catalog = catalogForScope(scope);
  if (!catalog) return { config, added: [] };

  const added: string[] = [];
  const existingMatIds = new Set(config.materials.map((m) => m.id));
  const mergedMaterials = [...config.materials];
  for (const m of catalog.materials) {
    if (!existingMatIds.has(m.id)) {
      mergedMaterials.push({ ...m });
      added.push(`material:${m.id}`);
    }
  }

  const mergedOptions: ProfileConfig["options"] = { ...config.options };
  for (const [groupId, catalogGroup] of Object.entries(catalog.options)) {
    const current = mergedOptions[groupId];
    if (!current) {
      mergedOptions[groupId] = {
        ...catalogGroup,
        items: catalogGroup.items.map((i) => ({ ...i })),
      };
      for (const item of catalogGroup.items) {
        added.push(`option:${groupId}:${item.id}`);
      }
      continue;
    }
    const existingIds = new Set(current.items.map((i) => i.id));
    const mergedItems = [...current.items];
    for (const item of catalogGroup.items) {
      if (!existingIds.has(item.id)) {
        mergedItems.push({ ...item });
        added.push(`option:${groupId}:${item.id}`);
      }
    }
    mergedOptions[groupId] = { ...current, items: mergedItems };
  }

  const merged: ProfileConfig = {
    ...config,
    materials: mergedMaterials,
    options: mergedOptions,
  };

  if (scope === "sticker" && !merged.cut_multipliers && catalog.cut_multipliers) {
    merged.cut_multipliers = { ...catalog.cut_multipliers };
    added.push("cut_multipliers");
  }

  return { config: merged, added };
}
