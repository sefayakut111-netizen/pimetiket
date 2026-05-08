/**
 * PimMemoryModuleService — Pim AI agent server-side memory.
 *
 * Şu an MedusaService base'i CRUD'ları otomatik üretir. Custom
 * method'lar I adımı (auth bağlanması) sonrasında doldurulacak:
 *
 *   - getProfileByCustomerId(customerId): {profile, facts, lastConv}
 *   - upsertFactFromAI(profileId, key, value): idempotent insert
 *   - summarizeConversation(conversationId): GPT-4o ile özet
 *   - withdrawConsent(profileId): KVKK silme — fact + history wipe
 */

import { MedusaService } from "@medusajs/framework/utils";
import { PimUserProfile } from "./models/pim-user-profile";
import { PimUserFact } from "./models/pim-user-fact";
import { PimConversation } from "./models/pim-conversation";
import { PimMessage } from "./models/pim-message";
import { PimConsent } from "./models/pim-consent";

class PimMemoryModuleService extends MedusaService({
  PimUserProfile,
  PimUserFact,
  PimConversation,
  PimMessage,
  PimConsent,
}) {
  // Custom method'lar I adımında doldurulacak
}

export default PimMemoryModuleService;
