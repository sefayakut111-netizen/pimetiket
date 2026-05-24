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
 * Validation (server-side, Sefa kuralı 18 May v54):
 *   - max size: 30 MB / dosya
 *   - max count: 50 dosya / sipariş (MultiDesignDropZone tarafında)
 *   - allowed format: PDF, PNG, JPG, AI, PSD, EPS
 *   - SVG kaldırıldı (Sefa kararı v54 — sade liste).
 *   - JPG geri eklendi (Sefa 20 May v68 — kullanıcı sıkça yüklüyor).
 *   - magic-byte check (mime spoofing'e karşı, AI ön-kontrol esnasında)
 */

import { SUPABASE_STORAGE_BUCKETS } from "./buckets";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/illustrator",
  "application/postscript", // EPS + AI (Adobe AI dosyalarını da bazen tetikler)
  "image/vnd.adobe.photoshop",
  "image/png",
  "image/jpeg", // Sefa 20 May v68: kullanıcı sıkça yüklüyor (fotoğraf tasarım)
] as const;

/** Tarayıcı .ai/.psd/.eps için MIME döndürmediği durumda uzantı bazlı kontrol */
export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".ai",
  ".psd",
  ".eps",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB — Supabase Storage limiti
/** R2 direct upload üst sınırı (büyük PSD vb.) */
export const MAX_R2_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_FILES_PER_ORDER = 50; // Sefa 18 May v54
export const STORAGE_BUCKET = SUPABASE_STORAGE_BUCKETS.designs;

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/** MIME yoksa uzantıya bak — AI/PSD/EPS çoğu tarayıcıda mime boş. */
export function isAllowedByExtension(fileName: string): boolean {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = fileName.slice(lastDot).toLowerCase();
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
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
