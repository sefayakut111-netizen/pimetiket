/**
 * QCPipelineModuleService — dosya QC akışı yönetimi.
 *
 * Custom methods (G adımı sonu eklenecek):
 *   - submitFile(orderId, fileId) → AI çağrısı tetikler, QCJob oluşturur
 *   - aiAnalyze(jobId) → Claude Vision API, findings'i flag'lere çevirir
 *   - operatorDecide(jobId, decision, notes)
 *
 * AI çağrısı için Claude API key .env'de:
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

import { MedusaService } from "@medusajs/framework/utils";
import { QCJob } from "./models/qc-job";
import { QCFlag } from "./models/qc-flag";

class QCPipelineModuleService extends MedusaService({
  QCJob,
  QCFlag,
}) {
  // Custom QC logic — G adımı sonunda
}

export default QCPipelineModuleService;
