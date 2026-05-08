/**
 * Winding direction — sarım yönü (1-8).
 * 1-4: dışa sarım (4 yönlü R rotasyonu)
 * 5-8: içe sarım (4 yönlü R rotasyonu)
 *
 * Otomasyon makinelerinde label aplikatörünün hangi yönden besleneceğini
 * belirler. Sarım 1 en yaygın varsayılan.
 */

import { model } from "@medusajs/framework/utils";

export const WindingDirection = model.define("winding_direction", {
  id: model.id().primaryKey(),
  // 1-8 (sarım numarası)
  number: model.number().unique(),
  // "outer" (1-4) veya "inner" (5-8)
  type: model.enum(["outer", "inner"]),
  // "Sarım 1", "Sarım 5" vb.
  label: model.text(),
  // R harfinin rotasyon derecesi (0/90/180/-90)
  r_rotation: model.number(),
  description: model.text().nullable(),
});
