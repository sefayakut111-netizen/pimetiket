/**
 * LabelProduct — Medusa Product'a Pim Etiket'e özel konfigürasyon meta'sı bağlar.
 *
 * Medusa'nın ürün/varyant modeli SKU bazlıdır; serbest mm ölçü +
 * tier indirimleri için bu ek katmana ihtiyaç var. Sipariş line_item'ına
 * konfigürasyon detayları metadata olarak yazılır.
 */

import { model } from "@medusajs/framework/utils";

export const LabelProduct = model.define("label_product", {
  id: model.id().primaryKey(),
  // Medusa Product ID (link)
  product_id: model.text().unique(),
  // "etiket" veya "sticker"
  kind: model.enum(["etiket", "sticker"]),
  // Min/Max sipariş adedi (etiket: 1000-50000, sticker: 25-2500)
  min_qty: model.number(),
  max_qty: model.number(),
  // Adet artış miktarı (etiket: 1000, sticker: tier-bazlı)
  qty_step: model.number().default(1),
  // Tier breakpoints — JSON: [{qty, multiplier}]
  // örn: [{qty:2000, m:0.96}, {qty:5000, m:0.9}, ...]
  tier_discounts: model.json().nullable(),
  // Hangi malzemeler/kaplamalar/customizations bu ürün için geçerli
  // JSON array of material/coating/customization IDs
  available_materials: model.json().nullable(),
  available_coatings: model.json().nullable(),
  available_customizations: model.json().nullable(),
});
