/**
 * Storage bucket adları ve path şablonları — tek kaynak.
 *
 * Dokümantasyon: docs/DOSYA-AKISI.md
 * Doğrulama: scripts/verify-upload-chain.mjs
 */

/** Supabase Storage bucket adları (Migration 006+) */
export const SUPABASE_STORAGE_BUCKETS = {
  designs: "designs",
  designPreviews: "design-previews",
  /** Legacy/override; birincil cutline SVG Cloudflare R2'de */
  cutlines: "cutlines",
  reviewPhotos: "review-photos",
  gallery: "gallery",
  fasonContracts: "fason-contracts",
} as const;

export type SupabaseStorageBucket =
  (typeof SUPABASE_STORAGE_BUCKETS)[keyof typeof SUPABASE_STORAGE_BUCKETS];

/** Cloudflare R2 cold archive bucket (env: R2_BUCKET) */
export const R2_ARCHIVE_BUCKET_DEFAULT = "pim-etiket-archive";

/** Orijinal tasarım: designs/{orderId}/{fileId}.{ext} */
export function designFileStoragePath(
  orderId: string,
  fileId: string,
  ext: string
): string {
  return `${SUPABASE_STORAGE_BUCKETS.designs}/${orderId}/${fileId}.${ext}`;
}

/** Sepet thumbnail: design-previews/{userId}/{designId}.png */
export function designPreviewStoragePath(
  userId: string,
  designId: string
): string {
  return `${SUPABASE_STORAGE_BUCKETS.designPreviews}/${userId}/${designId}.png`;
}

/** R2 cutline SVG: customer-cutlines/{orderId}/{itemId}/{timestamp}.svg */
export function r2CutlineSvgKey(
  orderId: string,
  itemId: string,
  timestamp: number
): string {
  return `customer-cutlines/${orderId}/${itemId}/${timestamp}.svg`;
}

/** R2 cutline preview PNG */
export function r2CutlinePreviewKey(
  orderId: string,
  itemId: string,
  timestamp: number
): string {
  return `customer-cutlines/${orderId}/${itemId}/${timestamp}-preview.png`;
}

/** R2 büyük dosya staging: customers-hot/{userId}/pending/{fileId}.{ext} */
export function r2PendingDesignKey(
  userId: string,
  fileId: string,
  ext: string
): string {
  return `customers-hot/${userId}/pending/${fileId}.${ext}`;
}

/** Upload API zinciri (statik doğrulama / dokümantasyon) */
export const UPLOAD_CHAIN_ENDPOINTS = {
  preview: "POST /api/cart/upload-preview",
  init: "POST /api/design/upload-init",
  initR2: "POST /api/design/upload-init-r2",
  complete: "POST /api/design/upload-complete",
  aiQc: "POST /api/agents/design-qc",
  cutlineSave: "POST /api/orders/[id]/proof/[itemId]/save-edit",
} as const;
