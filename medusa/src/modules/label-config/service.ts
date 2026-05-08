/**
 * LabelConfigModuleService — Pim Etiket konfigürasyon modülü.
 *
 * Medusa'nın varyant SKU modelinin üstünde Pim Etiket'in serbest mm,
 * malzeme/kaplama/yaldız seçimleri ve sarım yönü gibi katmanlarını yönetir.
 *
 * MedusaService base sınıfı CRUD method'larını otomatik üretir:
 *   - createMaterials, retrieveMaterial, listMaterials, updateMaterials, deleteMaterials
 *   - aynısı: Coating, Customization, WindingDirection, LabelProduct
 *
 * Custom method'lar (G adımı sonu eklenecek):
 *   - getConfigForProduct(productId) — ürün için tam konfigürasyon
 *   - validateConfig(productId, selection) — seçim geçerli mi
 */

import { MedusaService } from "@medusajs/framework/utils";
import { Material } from "./models/material";
import { Coating } from "./models/coating";
import { Customization } from "./models/customization";
import { WindingDirection } from "./models/winding";
import { LabelProduct } from "./models/label-product";

class LabelConfigModuleService extends MedusaService({
  Material,
  Coating,
  Customization,
  WindingDirection,
  LabelProduct,
}) {
  // Custom methods — G adımı sonunda doldurulacak
}

export default LabelConfigModuleService;
