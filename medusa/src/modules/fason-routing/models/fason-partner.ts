/**
 * FasonPartner — Pim Etiket'in fason baskı ortakları (Bursa atölyeleri vb).
 * Üretim outsource edildiği için her sipariş bir partner'a atanır.
 */

import { model } from "@medusajs/framework/utils";

export const FasonPartner = model.define("fason_partner", {
  id: model.id().primaryKey(),
  // Görüntü adı — "Bursa-1 Atölye"
  name: model.text(),
  // Şehir / ilçe
  city: model.text(),
  // İletişim
  contact_phone: model.text().nullable(),
  contact_email: model.text().nullable(),
  // Aylık kapasite (adet)
  monthly_capacity: model.number(),
  // Bu ay ne kadar yüklü (current_load)
  current_load: model.number().default(0),
  // Uzmanlık alanları — JSON array of strings
  // ["etiket", "yaldız", "emboss", "sticker", "holografik"]
  specialities: model.json(),
  // Rating 0-5 (review based)
  rating: model.number().default(5),
  // Toplam tamamlanan sipariş
  total_orders: model.number().default(0),
  // Aktif mi (false → atama yapılmaz)
  is_active: model.boolean().default(true),
  // Başlangıç tarihi
  partnered_since: model.dateTime().nullable(),
  // Notlar (operatör için)
  internal_notes: model.text().nullable(),
});
