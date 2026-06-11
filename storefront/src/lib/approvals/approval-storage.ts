/**
 * Onay görseli depolama — designs bucket approvals/{orderId}/{requestId}/{uuid}.{ext}
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import type { AllowedMime } from "@/lib/storage/design-files";
import { SUPABASE_STORAGE_BUCKETS } from "@/lib/storage/buckets";

export const APPROVAL_BUCKET = SUPABASE_STORAGE_BUCKETS.designs;
export const APPROVAL_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const APPROVAL_MAX_FILES_PER_REQUEST = 6;
export const APPROVAL_SIGNED_URL_TTL_SEC = 300;

export const APPROVAL_ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export type ApprovalMime = (typeof APPROVAL_ALLOWED_MIMES)[number];

const MIME_EXT: Record<ApprovalMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function detectWebp(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  return (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  );
}

function toAllowedMimeForMagic(claimed: string): AllowedMime | null {
  switch (claimed) {
    case "image/png":
      return "image/png";
    case "image/jpeg":
      return "image/jpeg";
    case "application/pdf":
      return "application/pdf";
    default:
      return null;
  }
}

/** Magic-byte doğrulama — png/jpg/pdf reuse + webp yerel tespit */
export function detectApprovalMime(
  buf: Uint8Array,
  claimedMime: string
): { mime: ApprovalMime | null; error?: string } {
  if (!APPROVAL_ALLOWED_MIMES.includes(claimedMime as ApprovalMime)) {
    return { mime: null, error: "format_not_allowed" };
  }

  if (claimedMime === "image/webp") {
    if (!detectWebp(buf)) {
      return { mime: null, error: "mime_mismatch" };
    }
    return { mime: "image/webp" };
  }

  const allowed = toAllowedMimeForMagic(claimedMime);
  if (!allowed) {
    return { mime: null, error: "format_not_allowed" };
  }

  const magic = detectMimeFromMagicBytes(
    buf.slice(0, Math.min(buf.length, 512)),
    allowed
  );
  if (!magic.matchesClaim) {
    return {
      mime: null,
      error: `mime_mismatch:${magic.detected ?? "unknown"}`,
    };
  }
  return { mime: claimedMime as ApprovalMime };
}

export function approvalAssetStoragePath(
  orderId: string,
  requestId: string,
  ext: string
): string {
  return `approvals/${orderId}/${requestId}/${randomUUID()}.${ext}`;
}

export function validateApprovalFileCount(count: number): string | null {
  if (count < 1) return "Dosya gerekli";
  if (count > APPROVAL_MAX_FILES_PER_REQUEST) {
    return `En fazla ${APPROVAL_MAX_FILES_PER_REQUEST} dosya yüklenebilir`;
  }
  return null;
}

export function validateApprovalFileSize(size: number): string | null {
  if (size > APPROVAL_MAX_FILE_BYTES) {
    return `Dosya çok büyük (max ${APPROVAL_MAX_FILE_BYTES / 1024 / 1024} MB)`;
  }
  if (size <= 0) return "Dosya boş";
  return null;
}

export async function uploadApprovalAsset(
  admin: SupabaseClient,
  orderId: string,
  requestId: string,
  bytes: Uint8Array,
  mime: ApprovalMime
): Promise<{ storagePath: string } | { error: string }> {
  const ext = MIME_EXT[mime];
  const storagePath = approvalAssetStoragePath(orderId, requestId, ext);
  const { error } = await admin.storage.from(APPROVAL_BUCKET).upload(
    storagePath,
    bytes,
    {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    }
  );
  if (error) {
    return { error: error.message };
  }
  return { storagePath };
}

export async function createApprovalAssetSignedUrl(
  admin: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(APPROVAL_BUCKET)
    .createSignedUrl(storagePath, APPROVAL_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
