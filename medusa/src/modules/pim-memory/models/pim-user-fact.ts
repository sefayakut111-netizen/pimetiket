/**
 * PimUserFact — Pim'in sohbetlerden çıkardığı key-value gerçekler.
 *
 * Örnekler:
 *   key: "favori_malzeme"        value: "kraft"
 *   key: "ilk_siparis_tarihi"    value: "2026-05-12"
 *   key: "marka_renk"            value: "#E04B3C"
 *   key: "buyuk_siparis_esik"    value: "5000 adet"
 *
 * Recall: kullanıcı her geldiğinde son N fact prompt'a inject edilir.
 */

import { model } from "@medusajs/framework/utils";

export const PimUserFact = model.define("pim_user_fact", {
  id: model.id().primaryKey(),
  // Profile FK (string referans, ileride relation eklenir)
  profile_id: model.text(),
  // Snake_case key
  key: model.text(),
  // Serbest metin değer
  value: model.text(),
  // 0-1 arası AI'ın güven skoru
  confidence: model.number().default(1),
  // Hangi sohbette/persona'da öğrenildi
  source_persona: model.text().nullable(),
  source_conversation_id: model.text().nullable(),
});
