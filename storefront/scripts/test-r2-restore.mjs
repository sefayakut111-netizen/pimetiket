/**
 * R2 Restore Test Script — Arşivden signed URL üretme testi.
 *
 * KULLANIM:
 *   node scripts/test-r2-restore.mjs <design_file_uuid> <requester_user_uuid>
 *
 * Çıktı:
 *   - Signed URL (browser'da aç, dosya inmeli)
 *   - Expires at timestamp
 *   - archive_events tablosunda cold_access kayıt
 */

import { getArchivedDesignFileUrl } from "../src/lib/storage/restore-service.ts";

const designFileId = process.argv[2];
const requesterId = process.argv[3];

if (!designFileId || !requesterId) {
  console.error(
    "Kullanım: node scripts/test-r2-restore.mjs <design_file_uuid> <requester_user_uuid>"
  );
  process.exit(1);
}

console.log(`[test] Restore URL talebi:`);
console.log(`  Design file: ${designFileId}`);
console.log(`  Requester:   ${requesterId}`);
console.log();

const result = await getArchivedDesignFileUrl({
  designFileId,
  requesterId,
  requesterType: "user",
  reason: "Test script çağrısı",
});

if ("error" in result) {
  console.log("✗ Hata:", result.error);
  process.exit(1);
}

console.log("✓ Signed URL üretildi");
console.log(`  URL:       ${result.url}`);
console.log(`  Süresi:    ${result.expiresAt.toISOString()}`);
console.log(`  Dry-run:   ${result.dryRun ? "evet" : "hayır"}`);
console.log();
console.log("Bu URL'i tarayıcıda aç — dosya inmeli (1 saat geçerli).");
