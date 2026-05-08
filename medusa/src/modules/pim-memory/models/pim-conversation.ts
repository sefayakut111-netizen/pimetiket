/**
 * PimConversation — bir sohbet oturumu.
 * Persona değişiminde aynı conversation içinde kalır, handoff event'i atılır.
 */

import { model } from "@medusajs/framework/utils";

export const PimConversation = model.define("pim_conversation", {
  id: model.id().primaryKey(),
  profile_id: model.text(),
  // Şu anki aktif persona
  current_persona: model.text().default("welcome"),
  // İlk persona (analytics için)
  initial_persona: model.text().default("welcome"),
  // AI'ın özetlediği son durum (uzun sohbetler için)
  summary: model.text().nullable(),
  // Sohbet hala açık mı
  is_active: model.boolean().default(true),
  closed_at: model.dateTime().nullable(),
});
