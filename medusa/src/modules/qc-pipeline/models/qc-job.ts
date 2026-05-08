/**
 * QCJob — yüklenmiş tasarım dosyasının kalite kontrol süreci.
 * Sipariş başına 1 (veya yeni dosya yüklendiğinde yeni job).
 */

import { model } from "@medusajs/framework/utils";

export const QCJob = model.define("qc_job", {
  id: model.id().primaryKey(),
  // Sipariş ID (Medusa Order)
  order_id: model.text().index(),
  // file-upload modülünden gelir (UploadedFile.id)
  file_id: model.text(),
  status: model
    .enum([
      "pending", // dosya yüklenmiş, AI kontrol bekliyor
      "ai_done", // AI ön kontrol bitti, operatöre düştü
      "operator_review", // operatör inceliyor
      "approved", // onaylandı, üretime gidebilir
      "rejected", // müşteriye düzeltme isteniyor
    ])
    .default("pending"),
  // AI bulgularını JSON olarak sakla (QCFlag relation yerine — flexibility)
  ai_findings: model.json().nullable(),
  ai_completed_at: model.dateTime().nullable(),
  operator_id: model.text().nullable(),
  operator_notes: model.text().nullable(),
  decided_at: model.dateTime().nullable(),
});
