/**
 * Tasarım dosyası storage helper'ları.
 *
 * Akış:
 *   1. Client: /api/design/upload-init POST → server signed URL döner
 *   2. Client: signed URL'e PUT ile dosya yükler (browser → Supabase Storage)
 *   3. Client: /api/design/upload-complete POST → server design_files INSERT
 *      (status=uploaded) + AI ön-kontrol queue'ya at (P5-5)
 *
 * Bucket: `designs` (privé)
 * Path: `designs/<orderId>/<uuid>.<ext>`
 *
 * Validation (server-side):
 *   - max size: 30 MB
 *   - allowed mime: PDF, AI, EPS, PSD, PNG, JPG, SVG
 *   - magic-byte check (mime spoofing'e karşı, AI ön-kontrol esnasında)
 */

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/illustrator",
  "application/postscript",
  "image/vnd.adobe.photoshop",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
export const STORAGE_BUCKET = "designs";

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "application/illustrator":
      return "ai";
    case "application/postscript":
      return "eps";
    case "image/vnd.adobe.photoshop":
      return "psd";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

export interface UploadInitResult {
  uploadUrl: string;
  storagePath: string;
  fileId: string;
  expiresAt: string;
}

export interface UploadCompleteParams {
  fileId: string;
  orderId: string;
  storagePath: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  sha256?: string;
}
