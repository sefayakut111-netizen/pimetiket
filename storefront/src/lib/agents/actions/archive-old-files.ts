/**
 * Aksiyon: archive_old_files — 90 gün+ design_files temizle.
 *
 * Payload:
 *   { fileIds: string[], reason?: string }
 *
 * Sefa kuralı (KVKK retention + Sefa kararı):
 *   - Tasarım dosyaları 90 günden eski + sipariş tamamlanmış → temizle
 *   - Storage'dan silinir, DB kaydı işaretlenir (deleted_at)
 *   - Hard delete YAPILMAZ (audit trail için kayıt kalır)
 */

import type { ActionHandler } from "../_shared/proposal";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

interface ArchivePayload {
  fileIds: string[];
  reason?: string;
}

const archiveOldFiles: ActionHandler = async ({ admin, payload }) => {
  const { fileIds, reason = "retention_90day" } =
    payload as unknown as ArchivePayload;

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return {
      result: "failed",
      error: "Invalid payload: 'fileIds' required",
    };
  }

  // 1) DB'den storage_path'leri çek
  const { data: filesData, error: fetchErr } = await admin
    .from("design_files")
    .select("id, storage_path")
    .in("id", fileIds);

  if (fetchErr) {
    return {
      result: "failed",
      error: `DB fetch failed: ${fetchErr.message}`,
    };
  }

  const files = (filesData ?? []) as Array<{
    id: string;
    storage_path: string;
  }>;

  if (files.length === 0) {
    return {
      result: "failed",
      error: "No files found with given IDs",
    };
  }

  // 2) Storage'dan toplu sil
  const paths = files.map((f) => f.storage_path);
  const { error: storageErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .remove(paths);

  // 3) DB kaydını işaretle (storage_path = null + soft mark)
  const { data: updated, error: updateErr } = await admin
    .from("design_files")
    .update({
      storage_path: null,
      // archived_at gibi bir kolon yoksa metadata.archived flag
    } as never)
    .in("id", files.map((f) => f.id))
    .select("id");

  if (updateErr) {
    return {
      result: "partial",
      affectedRows: 0,
      error: `Storage cleared but DB update failed: ${updateErr.message}`,
      externalCall: { storagePaths: paths, storageError: storageErr?.message },
    };
  }

  const updatedCount = (updated ?? []).length;

  return {
    result:
      storageErr || updatedCount < files.length ? "partial" : "success",
    affectedRows: updatedCount,
    affectedIds: { fileIds: files.map((f) => f.id) },
    externalCall: {
      requested: fileIds.length,
      storagePaths: paths.length,
      dbUpdated: updatedCount,
      reason,
      storageError: storageErr?.message,
    },
  };
};

export default archiveOldFiles;
