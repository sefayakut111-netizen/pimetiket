/**
 * ProofModuleService — prova üretim ve müşteri onay akışı.
 *
 * Custom methods (G/I adımı):
 *   - createProof(orderId, proofFileUrl) → operatör render edip yükler
 *   - sendToCustomer(jobId) → email + dashboard bildirimi
 *   - customerDecide(jobId, "approve" | "request_changes", notes?)
 */

import { MedusaService } from "@medusajs/framework/utils";
import { ProofJob } from "./models/proof-job";

class ProofModuleService extends MedusaService({ ProofJob }) {
  // Custom proof logic — G adımı sonunda
}

export default ProofModuleService;
