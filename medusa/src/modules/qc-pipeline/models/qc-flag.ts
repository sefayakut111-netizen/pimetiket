/**
 * QCFlag — bir QCJob'da AI veya operatörün tespit ettiği sorun.
 */

import { model } from "@medusajs/framework/utils";

export const QCFlag = model.define("qc_flag", {
  id: model.id().primaryKey(),
  job_id: model.text().index(),
  severity: model.enum(["warning", "fatal"]),
  category: model.enum([
    "renk", // CMYK/RGB problemi
    "cozunurluk", // DPI yetersiz
    "marka", // 3. taraf telif/marka ihlali
    "yazim", // yazım hatası
    "boyut", // bleed/safe zone hatası
    "guvenlik", // dosya güvenlik sorunu
  ]),
  message: model.text(),
  // İsteğe bağlı: PDF/raster üzerinde işaretli alan
  // {x, y, w, h, page} JSON
  bbox: model.json().nullable(),
  // AI mı operatör mü tespit etti
  source: model.enum(["ai", "operator"]).default("ai"),
});
