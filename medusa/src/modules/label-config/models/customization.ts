/**
 * Customization — premium dokunuş (sıcak yaldız, emboss, spot UV).
 * Yaldız seçilince ek olarak yaldız_color seçilir (8 ton).
 */

import { model } from "@medusajs/framework/utils";

export const Customization = model.define("customization", {
  id: model.id().primaryKey(),
  code: model.text().unique(),
  name: model.text(),
  description: model.text().nullable(),
  base_price: model.number(),
  // Bu seçenek seçilince ek alt-seçim açılır mı? (yaldız → 8 renk)
  has_color_option: model.boolean().default(false),
  // Renk seçenekleri (yaldız için)
  // {id, name, gradient}[] JSON array
  color_options: model.json().nullable(),
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),
});
