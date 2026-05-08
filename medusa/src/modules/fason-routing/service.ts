/**
 * FasonRoutingModuleService — fason ortağı atama mantığı.
 *
 * Custom methods (G adımı):
 *   - autoAssign(orderId) → kapasite + speciality + rating skoru ile en iyi fason
 *   - manualAssign(orderId, partnerId)
 *   - markCompleted(assignmentId)
 *   - getCapacityReport() → tüm fasonların kapasite kullanım özeti
 */

import { MedusaService } from "@medusajs/framework/utils";
import { FasonPartner } from "./models/fason-partner";
import { FasonAssignment } from "./models/fason-assignment";

class FasonRoutingModuleService extends MedusaService({
  FasonPartner,
  FasonAssignment,
}) {
  // Custom routing logic — G adımı sonunda
}

export default FasonRoutingModuleService;
