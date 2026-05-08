/**
 * PimMessage — sohbet transcript'i.
 *
 * NOT: ileride pgvector embedding alanı eklenecek (semantic recall için).
 * Şu an düz tablo, recall için son N mesaj kullanılır.
 */

import { model } from "@medusajs/framework/utils";

export const PimMessage = model.define("pim_message", {
  id: model.id().primaryKey(),
  conversation_id: model.text(),
  // "user" | "assistant"
  role: model.text(),
  content: model.text(),
  // Hangi persona söyledi (assistant için)
  persona: model.text().nullable(),
  // Token usage tracking
  prompt_tokens: model.number().nullable(),
  completion_tokens: model.number().nullable(),
});
