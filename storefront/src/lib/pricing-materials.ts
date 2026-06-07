import type { MaterialItem, ProfileConfig } from "./pricing-config-types";

/** Müşteri tarafında gösterilecek malzemeler (active !== false). */
export function getActiveMaterials(
  config: ProfileConfig | null | undefined
): MaterialItem[] {
  if (!config?.materials?.length) return [];
  return config.materials.filter((m) => m.active !== false);
}

/** Tabaka sheet modunda fiyatı tanımlı malzeme id'leri (canlı config). */
export function getPricedTabakaMaterialIds(
  config: ProfileConfig | null | undefined
): string[] {
  return getActiveMaterials(config)
    .filter(
      (m) =>
        m.sheet_sell_try != null ||
        m.sheet_cost_try != null
    )
    .map((m) => m.id);
}
