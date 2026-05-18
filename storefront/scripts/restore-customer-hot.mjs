/**
 * Bir müşteriyi 'cold' → 'hot' geri almak (Supabase profile flag reset).
 *
 * KULLANIM:
 *   npx tsx --env-file=.env.local scripts/restore-customer-hot.mjs <user_uuid>
 *
 * NOT: R2'deki snapshot dosyası varsa silinmez (manuel temizlik gerekirse
 * Cloudflare R2 bucket'tan elle silinir). Bu script SADECE DB flag reset yapar.
 */

import { createClient } from "@supabase/supabase-js";

const userId = process.argv[2];
if (!userId) {
  console.error("Kullanım: npx tsx scripts/restore-customer-hot.mjs <user_uuid>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY env eksik");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`[restore] Hot'a geri alınıyor: ${userId}`);

const { data, error } = await supabase
  .from("profiles")
  .update({
    archive_status: "hot",
    archived_at: null,
    archive_path: null,
  })
  .eq("id", userId)
  .select("id, archive_status, archived_at, archive_path");

if (error) {
  console.error("✗ Hata:", error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error("✗ Kullanıcı bulunamadı:", userId);
  process.exit(1);
}

console.log("✓ Profile hot'a geri alındı:");
console.log(JSON.stringify(data[0], null, 2));

// Audit log
await supabase.from("archive_events").insert({
  event_type: "restored_to_hot",
  resource_type: "profile",
  resource_id: userId,
  user_id: userId,
  actor_type: "system",
  reason: "Smoke test restore (manuel script çağrısı)",
});
console.log("✓ archive_events'e 'restored_to_hot' kayıt eklendi");
