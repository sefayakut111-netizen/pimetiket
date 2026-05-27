export type FasonProductType = "roll_label" | "sheet_label" | "sticker";
export type FasonMaterial = "paper" | "transparent" | "metallic" | "holographic";

export const FASON_PRODUCT_LABELS: Record<FasonProductType, string> = {
  roll_label: "Rulo Etiket",
  sheet_label: "Tabaka Etiket",
  sticker: "Sticker",
};

export const FASON_MATERIAL_LABELS: Record<FasonMaterial, string> = {
  paper: "Kagit",
  transparent: "Seffaf",
  metallic: "Metalize",
  holographic: "Holografik",
};

/** Urun grubuna gore secilebilir malzemeler */
export const FASON_PRODUCT_MATERIALS: Record<FasonProductType, FasonMaterial[]> =
  {
    sticker: ["paper", "transparent", "metallic", "holographic"],
    roll_label: ["paper", "transparent", "metallic", "holographic"],
    sheet_label: ["paper", "transparent", "metallic"],
  };

export const FASON_PRODUCT_TYPES = Object.keys(
  FASON_PRODUCT_LABELS
) as FasonProductType[];

export function parsePartnerCapabilities(
  capabilities: Array<{
    capability_type: string;
    capability_value: string;
  }> = []
): { productTypes: FasonProductType[]; materials: FasonMaterial[] } {
  const productTypes = capabilities
    .filter((c) => c.capability_type === "product_type")
    .map((c) => c.capability_value as FasonProductType)
    .filter((v) => v in FASON_PRODUCT_LABELS);
  const materials = capabilities
    .filter((c) => c.capability_type === "material")
    .map((c) => c.capability_value as FasonMaterial)
    .filter((v) => v in FASON_MATERIAL_LABELS);
  return { productTypes, materials };
}

export function materialsForProduct(
  productType: FasonProductType,
  materials: FasonMaterial[]
): FasonMaterial[] {
  const options = FASON_PRODUCT_MATERIALS[productType];
  return materials.filter((m) => options.includes(m));
}

export function toggleProductType(
  productTypes: FasonProductType[],
  materials: FasonMaterial[],
  pt: FasonProductType
): { productTypes: FasonProductType[]; materials: FasonMaterial[] } {
  if (productTypes.includes(pt)) {
    const options = FASON_PRODUCT_MATERIALS[pt];
    return {
      productTypes: productTypes.filter((p) => p !== pt),
      materials: materials.filter((m) => !options.includes(m)),
    };
  }
  const options = FASON_PRODUCT_MATERIALS[pt];
  return {
    productTypes: [...productTypes, pt],
    materials: [...new Set([...materials, ...options])],
  };
}

export function setMaterialsForProduct(
  productType: FasonProductType,
  materials: FasonMaterial[],
  next: FasonMaterial[]
): FasonMaterial[] {
  const options = FASON_PRODUCT_MATERIALS[productType];
  const without = materials.filter((m) => !options.includes(m));
  return [...new Set([...without, ...next])];
}
