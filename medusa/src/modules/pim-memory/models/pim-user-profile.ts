/**
 * PimUserProfile — Pim'in her müşteri için tuttuğu tek satır profil.
 * Customer (Medusa) ile 1:1 bağlanır.
 */

import { model } from "@medusajs/framework/utils";

export const PimUserProfile = model.define("pim_user_profile", {
  id: model.id().primaryKey(),
  // Medusa customer.id ile bağ (auth bağlandığında)
  customer_id: model.text().unique().nullable(),
  // Anonim user için localStorage UUID
  anon_user_id: model.text().unique().nullable(),
  // Kullanıcının kendi söylediği isim (Pim'in hitap için)
  display_name: model.text().nullable(),
  // Marka adı (varsa)
  brand_name: model.text().nullable(),
  // Sektör: "kozmetik" | "gida" | "icecek" | "diger" vs
  sector: model.text().nullable(),
  // Ton tercihi: "samimi" (default) | "resmi" | "kisa"
  tone_preference: model.text().default("samimi"),
  // Son aktivite (recall query için)
  last_seen_at: model.dateTime().nullable(),
});
