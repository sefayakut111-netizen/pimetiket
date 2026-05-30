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

export type CapabilityApprovalStatus = "pending" | "approved" | "rejected";

export function mapOrderItemToCapability(
  product: string,
  meta: {
    material?: string;
    materialId?: string;
    formFactor?: string;
  }
): { productType: FasonProductType; material: FasonMaterial | null } {
  const materialId = String(meta.materialId ?? meta.material ?? "").toLowerCase();
  const formFactor = String(meta.formFactor ?? "").toLowerCase();

  let productType: FasonProductType;
  if (product === "sticker") {
    productType = "sticker";
  } else if (formFactor === "tabaka") {
    productType = "sheet_label";
  } else {
    productType = "roll_label";
  }

  let material: FasonMaterial | null = null;
  if (
    ["vinil", "opak", "opakpp", "beyaz", "kuse", "kraft", "kuşe"].includes(
      materialId
    )
  ) {
    material = "paper";
  } else if (
    ["transparan", "seffaf", "ultra", "ultraclear"].includes(materialId)
  ) {
    material = "transparent";
  } else if (["holo", "holografik", "holographic"].includes(materialId)) {
    material = "holographic";
  } else if (
    ["simli", "metalik", "metalize", "metallic"].includes(materialId)
  ) {
    material = "metallic";
  }

  return { productType, material };
}

export function getCapabilityRecord(
  capabilities: Array<{
    id?: string;
    capability_type: string;
    capability_value: string;
    is_verified?: boolean;
    approval_status?: CapabilityApprovalStatus;
  }> = [],
  capabilityType: "product_type" | "material",
  capabilityValue: string
) {
  return capabilities.find(
    (c) =>
      c.capability_type === capabilityType &&
      c.capability_value === capabilityValue
  );
}

export function resolveApprovalStatus(cap: {
  is_verified?: boolean;
  approval_status?: CapabilityApprovalStatus;
}): CapabilityApprovalStatus {
  if (cap.approval_status) return cap.approval_status;
  return cap.is_verified ? "approved" : "pending";
}

export function partnerHasApprovedCapability(
  capabilities: Array<{
    id?: string;
    capability_type: string;
    capability_value: string;
    is_verified?: boolean;
    approval_status?: CapabilityApprovalStatus;
  }> = [],
  productType: FasonProductType,
  material: FasonMaterial | null
): { ok: boolean; productOk: boolean; materialOk: boolean } {
  const productCap = getCapabilityRecord(
    capabilities,
    "product_type",
    productType
  );
  const productOk =
    !!productCap && resolveApprovalStatus(productCap) === "approved";

  if (!material) {
    return { ok: productOk, productOk, materialOk: true };
  }

  const materialCap = getCapabilityRecord(capabilities, "material", material);
  const materialOk =
    !!materialCap && resolveApprovalStatus(materialCap) === "approved";

  return { ok: productOk && materialOk, productOk, materialOk };
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
