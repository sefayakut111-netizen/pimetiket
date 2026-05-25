import type { MaterialItem, ProfileConfig } from "./pricing-config-types";

/** Müşteri tarafında gösterilecek malzemeler (active !== false). */
export function getActiveMaterials(
  config: ProfileConfig | null | undefined
): MaterialItem[] {
  if (!config?.materials?.length) return [];
  return config.materials.filter((m) => m.active !== false);
}
