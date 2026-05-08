/**
 * Coating — kaplama (mat selefon, parlak, soft touch, kaplama yok).
 */

import { model } from "@medusajs/framework/utils";

export const Coating = model.define("coating", {
  id: model.id().primaryKey(),
  code: model.text().unique(),
  name: model.text(),
  description: model.text().nullable(),
  product_type: model.enum(["etiket", "sticker", "both"]).default("both"),
  base_price: model.number(),
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),
});
