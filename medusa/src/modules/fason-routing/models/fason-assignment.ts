/**
 * FasonAssignment — bir siparişin hangi fason ortağına atandığı.
 */

import { model } from "@medusajs/framework/utils";

export const FasonAssignment = model.define("fason_assignment", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  partner_id: model.text().index(),
  status: model
    .enum([
      "assigned", // atandı, fason'a iletildi
      "in_progress", // üretim başladı
      "completed", // tamamlandı, kargoya geçti
      "rejected_by_partner", // fason reddetti, yeni atama gerek
      "cancelled",
    ])
    .default("assigned"),
  assigned_at: model.dateTime(),
  started_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  // Otomatik mi atandı manuel mi
  assignment_method: model.enum(["auto", "manual"]).default("manual"),
  // Auto atama'da kullanılan skor (capacity, speciality match, rating)
  assignment_score: model.number().nullable(),
});
