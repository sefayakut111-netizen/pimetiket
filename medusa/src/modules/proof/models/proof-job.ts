/**
 * ProofJob — operatörün hazırladığı, müşteriye onay için gönderilen prova.
 * QC tamamlandıktan sonra başlar; müşteri onayı sonrası fason atamaya geçer.
 */

import { model } from "@medusajs/framework/utils";

export const ProofJob = model.define("proof_job", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  status: model
    .enum([
      "to_create", // operatör henüz oluşturmadı
      "in_progress", // operatör render ediyor
      "ready_to_send", // hazır, müşteriye gönderim bekleniyor
      "sent", // müşteriye gönderildi
      "customer_approved", // müşteri onayladı
      "customer_changes_requested", // müşteri değişiklik istedi
      "cancelled",
    ])
    .default("to_create"),
  // S3/R2 URL'i — render edilmiş prova PDF/PNG
  proof_url: model.text().nullable(),
  // Müşteri "Provayı onayla" / "Değişiklik iste" tıkladığında
  customer_response_at: model.dateTime().nullable(),
  customer_notes: model.text().nullable(),
  operator_id: model.text().nullable(),
  // Kaç tur revize edildi
  revision_count: model.number().default(0),
});
