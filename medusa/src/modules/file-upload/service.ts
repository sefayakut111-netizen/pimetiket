/**
 * FileUploadModuleService — tasarım dosyası yükleme + S3/R2 yönetimi.
 *
 * Custom methods (G adımı):
 *   - uploadFile(orderId, file) → S3'e yükler, hash hesaplar, kaydeder
 *   - getDownloadUrl(fileId) → signed URL (kısa süreli)
 *   - markFinal(fileId) → müşteri onayı sonrası
 *   - deduplicate(hash) → aynı hash önceden yüklenmiş mi
 *
 * Storage: Cloudflare R2 (S3-uyumlu, ucuz, TR'ye yakın). Yapılandırma .env'de:
 *   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_BUCKET, S3_ENDPOINT
 */

import { MedusaService } from "@medusajs/framework/utils";
import { UploadedFile } from "./models/uploaded-file";

class FileUploadModuleService extends MedusaService({ UploadedFile }) {
  // Custom upload logic — G adımı sonunda
}

export default FileUploadModuleService;
