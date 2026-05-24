/**
 * R2 Archive Test Script — DRY_RUN modunda güvenli test.
 *
 * KULLANIM:
 *   1. .env'de env vars set (R2_*, SUPABASE_*)
 *   2. R2_ARCHIVE_DRY_RUN=true (varsayılan)
 *   3. node scripts/test-r2-archive.mjs <user_uuid>
 *
 * Çıktı:
 *   ✓ Profile snapshot
 *   ✓ N siparişler arşivlendi
 *   ✓ N tasarım dosyası
 *   ✓ N yorum / iade
 *   Toplam: X bytes
 *
 * DRY_RUN=false yapmadan ÖNCE:
 *   - R2 dev bucket'ı doğrula
 *   - Test müşterisi seç (gerçek müşteri DEĞİL)
 */

import { archiveCustomer } from "../src/lib/storage/archive-service.ts";

const userId = process.argv[2];

if (!userId) {
  console.error("Kullanım: node scripts/test-r2-archive.mjs <user_uuid>");
  process.exit(1);
}

console.log(`[test] Müşteri arşivleme başlatılıyor: ${userId}`);
console.log(`[test] Archive DRY_RUN: ${process.env.R2_ARCHIVE_DRY_RUN !== "false"}`);
console.log(`[test] Hot path (cutline/manifest) her zaman gerçek R2 kullanır.`);
console.log();

const result = await archiveCustomer(userId, "Manuel test çağrısı");

console.log("=".repeat(60));
console.log("SONUÇ");
console.log("=".repeat(60));
console.log(JSON.stringify(result, null, 2));

if (result.success) {
  console.log("\n✓ Arşivleme başarılı");
  console.log(`  - Profile: ${result.itemsArchived.profile ? "✓" : "✗"}`);
  console.log(`  - Siparişler: ${result.itemsArchived.orders}`);
  console.log(`  - Order events: ${result.itemsArchived.orderEvents}`);
  console.log(`  - Tasarım dosyaları: ${result.itemsArchived.designFiles}`);
  console.log(`  - Yorumlar: ${result.itemsArchived.reviews}`);
  console.log(`  - İadeler: ${result.itemsArchived.returns}`);
  console.log(
    `  - Toplam: ${(result.totalBytes / 1024).toFixed(2)} KB`
  );
} else {
  console.log("\n✗ Arşivleme başarısız");
  console.log("Hatalar:", result.errors);
  process.exit(1);
}
