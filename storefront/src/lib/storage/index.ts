/**
 * Storage modülü — bucket sabitleri ve upload helper'ları.
 * @see docs/DOSYA-AKISI.md
 */

export {
  SUPABASE_STORAGE_BUCKETS,
  R2_ARCHIVE_BUCKET_DEFAULT,
  designFileStoragePath,
  designPreviewStoragePath,
  r2CutlineSvgKey,
  r2CutlinePreviewKey,
  r2PendingDesignKey,
  UPLOAD_CHAIN_ENDPOINTS,
  type SupabaseStorageBucket,
} from "./buckets";

export {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_R2_FILE_SIZE,
  MAX_FILES_PER_ORDER,
  STORAGE_BUCKET,
  isAllowedMime,
  isAllowedByExtension,
  getExtensionFromMime,
  type AllowedMime,
  type UploadInitResult,
  type UploadCompleteParams,
} from "./design-files";
