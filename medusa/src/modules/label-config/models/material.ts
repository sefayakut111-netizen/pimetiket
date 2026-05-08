/**
 * Material — etiket/sticker malzemesi (kraft, beyaz semi-glos, holografik vs).
 * Her ürünün konfigüratöründe seçilen ana malzeme.
 */

import { model } from "@medusajs/framework/utils";

export const Material = model.define("material", {
  id: model.id().primaryKey(),
  // Programatik kod (örn: "kraft", "vinil", "holo")
  code: model.text().unique(),
  // Kullanıcıya gösterilen isim (örn: "Kraft", "Holografik")
  name: model.text(),
  // 1-2 cümle açıklama (konfigüratörde swatch altında görünür)
  description: model.text().nullable(),
  // SVG/CSS swatch — gradient string veya hex
  swatch: model.text().nullable(),
  // Ürün tipi: "etiket" | "sticker" | "both"
  product_type: model.enum(["etiket", "sticker", "both"]).default("both"),
  // Pricing engine için baz birim fiyat (TL/adet, ölçü = 60×80mm baz)
  base_price: model.number(),
  // Aktif mi (false = konfigüratörde gösterme)
  is_active: model.boolean().default(true),
  // Sıralama
  sort_order: model.number().default(0),
});
