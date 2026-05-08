/**
 * PimConsent — KVKK opt-in audit izi.
 *
 * Kullanıcı "Pim seni hatırlasın mı?" sorusuna cevap verince burada
 * kayıt tutulur. Sonradan iptal de aynı tabloya yeni satır olarak girer
 * (immutable audit log).
 */

import { model } from "@medusajs/framework/utils";

export const PimConsent = model.define("pim_consent", {
  id: model.id().primaryKey(),
  profile_id: model.text(),
  // "granted" | "withdrawn"
  status: model.text(),
  // KVKK m.10 — aydınlatma metnine link/version
  policy_version: model.text().default("v1"),
  // IP/UserAgent audit (opsiyonel)
  ip: model.text().nullable(),
  user_agent: model.text().nullable(),
});
