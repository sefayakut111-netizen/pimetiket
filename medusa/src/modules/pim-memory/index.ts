/**
 * pim-memory — Pim AI agent için kullanıcı hafızası.
 *
 * Şu an storefront'ta localStorage backend var (anonim user).
 * Auth bağlandığında bu modül server-side memory'yi devralır.
 *
 * Şema:
 *   - PimUserProfile: kullanıcı bazlı tek satır (ad, marka, sektör, tercih)
 *   - PimUserFact: key-value öğrenilen gerçekler (favori malzeme vs)
 *   - PimConversation: sohbet oturumları
 *   - PimMessage: transcript (ileride embedding alanı eklenecek)
 *   - PimConsent: KVKK opt-in audit izi
 */

import { Module } from "@medusajs/framework/utils";
import PimMemoryModuleService from "./service";

export const PIM_MEMORY_MODULE = "pimMemory";

export default Module(PIM_MEMORY_MODULE, {
  service: PimMemoryModuleService,
});
