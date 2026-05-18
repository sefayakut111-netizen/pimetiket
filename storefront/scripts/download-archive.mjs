/**
 * download-archive.mjs — Admin manuel R2 arşiv erişim helper'ı.
 *
 * KULLANIM:
 *   npx tsx --env-file=.env.local scripts/download-archive.mjs <r2_key> [reason]
 *
 * ÖRNEK:
 *   # Müşteri profil snapshot'ı
 *   npx tsx --env-file=.env.local scripts/download-archive.mjs \
 *     "customers/7d9ac0b4-.../profile-snapshot.json" \
 *     "Sefa manuel kontrol"
 *
 *   # Bir müşteri için sipariş detay dosyası
 *   npx tsx --env-file=.env.local scripts/download-archive.mjs \
 *     "customers/<uuid>/orders/<order_id>.json"
 *
 * Çıktı:
 *   - 1 saatlik signed URL (tarayıcıda aç → dosya iner)
 *   - archive_events tablosuna 'cold_access' audit kayıt düşer
 *
 * NOT: Bu script SADECE admin/operasyonel kullanım içindir. Müşteri kendi
 * tasarım dosyasını çekmek istiyorsa /api/customer/design-files/[id]/restore-url
 * endpoint'i kullanılır (UI üzerinden RestoreArchivedFileButton).
 */

import { createClient } from "@supabase/supabase-js";
import { getSignedDownloadUrl } from "../src/lib/storage/r2-client.ts";

const r2Key = process.argv[2];
const reason = process.argv[3] ?? "Admin manuel erişim (operasyonel)";

if (!r2Key) {
  console.error(
    "Kullanım: npx tsx scripts/download-archive.mjs <r2_key> [reason]"
  );
  console.error("");
  console.error("Örnek r2_key'ler:");
  console.error('  "customers/<uuid>/profile-snapshot.json"');
  console.error('  "customers/<uuid>/orders/<order_id>.json"');
  console.error('  "customers/<uuid>/design-files/<file_uuid>.pdf"');
  process.exit(1);
}

console.log(`[download-archive] R2 key: ${r2Key}`);
console.log(`[download-archive] Reason: ${reason}`);
console.log();

// Signed URL üret
let signedUrl;
try {
  signedUrl = await getSignedDownloadUrl(r2Key, 3600); // 1 saat
} catch (err) {
  console.error("✗ Signed URL üretilemedi:", err.message);
  process.exit(1);
}
const expiresAt = new Date(Date.now() + 3600 * 1000);

console.log("✓ Signed URL üretildi (1 saat geçerli):");
console.log();
console.log(signedUrl);
console.log();
console.log(`Expires at: ${expiresAt.toISOString()}`);
console.log();

// Audit log
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url && key) {
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // r2_key'den user_id'yi parse et (customers/<uuid>/... formatında)
  const userIdMatch = r2Key.match(
    /^customers\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//
  );
  const userId = userIdMatch ? userIdMatch[1] : null;

  await supabase.from("archive_events").insert({
    event_type: "cold_access",
    resource_type: "manual_admin_download",
    resource_id: userId ?? "00000000-0000-0000-0000-000000000000",
    user_id: userId,
    actor_type: "admin",
    archive_path: r2Key,
    reason,
  });
  console.log("✓ archive_events'e 'cold_access' audit kayıt eklendi");
} else {
  console.warn(
    "⚠ NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY env eksik — audit log atlandı"
  );
}

console.log();
console.log("Bu URL'i tarayıcıda aç → dosya iner. 1 saat sonra link geçersiz.");
