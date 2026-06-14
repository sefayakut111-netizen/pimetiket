# Cursor Notları — M3: Tasarım Yükleme & Editör (sunucu)

> Hata-tespit (P2). Boyut: D2 sözleşme, D3 hata, D4 yarış, D6 güvenlik. Editör çekirdeği (poc.html/worker/geometri) önceki oturumda.
> **KÖK SORUN:** init→complete zincirinde orphan birikimi + çift complete idempotent değil (gerçek QC para harcar) + promote yarışı + cleanup cron'unun storage'ı hiç silmemesi.

## 🔴 KRİTİK

### 1. upload-init orphan: init edilen ama complete edilmeyen `status="uploaded"` kalıcı kayıt · D2/D3
- **Konum:** `api/design/upload-init/route.ts:172-187`, `upload-init-r2/route.ts:122-137`
- **Sorun:** upload-init signed URL anında `design_files` satırını `status:"uploaded"` ile INSERT ediyor. Client PUT/complete yapmazsa storage'da obje olmayan kalıcı kayıt kalır. TTL/cron temizliği yok. `version` hesabı bu orphan'ları sayar → init/abort tekrarı versiyon şişirir, QC/slot mantığını bozar.
- **Düzeltme:** init'te satırı ayrı `status:"pending"`/`"initializing"` ile aç; complete başarıyla bitince `analyzing`'e geçir; `design_files`'a `expires_at`+cron temizliği.

### 2. Çift complete idempotent değil → gereksiz storage indirme + gerçek GPT-4o QC re-trigger (para) · D4/D3
- **Konum:** `api/design/upload-complete/route.ts:83-91, 219-277`
- **Sorun:** complete satırı yalnız `id` ile çekiyor; `status` guard yok. Aynı `fileId` iki kez: (a) storage'dan tekrar indirme, (b) SVG re-sanitize+re-upload, (c) `order_events` çift log, (d) `scheduleOrderDesignQC` tekrar → çift gerçek GPT-4o Vision QC = **para harcar**.
- **Düzeltme:** İlk satırda `if (fileRow.status !== "uploaded") return {ok:true, idempotent:true}`. QC tetiklemeyi `.update(...).eq("id",fileId).eq("status","uploaded")` ile koşullu yap, 0 satır→atla.

### 3. Promote yarışı: eşzamanlı IPN'lerde aynı temp çift design_files satırı · D4
- **Konum:** `lib/storage/promote-temp-designs.ts:110-239` + `payment/callback/route.ts:416-447`
- **Sorun:** `promoteOneTemp` dedup'ı sıralı read-then-write (promoted_to kontrolü → existingByPath → INSERT), atomik kilit yok. PayTR aynı OID için iki IPN (duplicate dalı + ana dal) gönderirse iki promote aynı temp'i `promoted_to=null` görüp aynı orderPath için iki `fileId` INSERT eder. `storage_path` benzersiz değil.
- **Düzeltme:** Promote'u SECURITY DEFINER RPC'ye taşı veya `design_temp_uploads.promoted_to`'yu `UPDATE ... WHERE promoted_to IS NULL RETURNING` ile claim-first; INSERT yalnız claim başarılıysa. `design_files`'a `(order_id, storage_path)` partial unique. (Doğrulama #1, #5.)

### 4. temp-upload-complete: client `id`/`storagePath` tutarlılığı doğrulanmıyor · D4/D6
- **Konum:** `api/design/temp-upload-complete/route.ts:30-37, 176-201`
- **Sorun:** INSERT'te `id: body.fileId` doğrudan client UUID. `fileId` ile `storagePath` son segmenti arası tutarlılık yok → `fileId=A` ama `storagePath=.../B.png` gönderilebilir; promote `tempPath.split("/").pop()` kullandığından (`:155`) ayrışma riski. PK conflict'te ikinci çağrı `db_insert_failed` ama storage objesi orphan.
- **Düzeltme:** `id`'yi server üret veya `storagePath` son segmenti `fileId`'ye eşit doğrula; PK conflict'i 409 idempotent yap.

## 🟠 YÜKSEK

### 5. Client `sizeBytes` sunucuda hiç doğrulanmıyor · D2/D6
- **Konum:** `upload-init/route.ts:36,180`, `upload-complete` (yeniden ölçülmüyor), `temp-upload-complete/route.ts:34,184`
- **Sorun:** `sizeBytes` yalnız Zod aralık kontrolü, DB'ye client değeri. complete magic-byte indirirken gerçek boyutu ölçmüyor. Client `sizeBytes:1000` deyip 500MB yükleyebilir → DB yanlış boyut, downstream patlar.
- **Düzeltme:** complete'te indirme sırasında gerçek `Content-Length`/obje boyutu al, `MAX_FILE_SIZE` ile karşılaştır, uyuşmazsa reject + `size_bytes` güncelle. (Doğrulama #2.)

### 6. Promote'ta magic-byte/SVG sanitize yok — temp doğrulamasını atlayan dosya design_files'a geçebilir · D2/D6
- **Konum:** `lib/storage/promote-temp-designs.ts:189-221, 151-153, 233-238`
- **Sorun:** Promote `metaForTempId` fallback ile `design_temp_uploads` satırı OLMAYAN tempId için bile order meta'sından promote edebiliyor → magic-byte guard'ından geçmemiş storage objesi design_files'a girer.
- **Düzeltme:** Promote yalnız `design_temp_uploads` satırı bulunan + magic-byte'tan geçmiş (`verified=true`) tempId'leri işlesin; meta-fallback'i kaldır veya o yolda da magic-byte ekle.

### 9. enhance & bg-remove kalıcı orphan temp üretiyor + cron storage'ı SİLMİYOR · D3
- **Konum:** `enhance/route.ts:157-181`, `bg-remove/route.ts:88-109`; `fn_cleanup_temp_designs` (Mig 008:124-135 storage silme "TODO")
- **Sorun:** Her enhance/bg-remove yeni `design_temp_uploads`+storage objesi yaratıyor; kabul edilmezse 24h cron'a kalıyor ama cron **yalnız DB row siliyor, storage'ı silmiyor** → kalıcı storage orphan birikimi (replicate/R2 maliyeti).
- **Düzeltme:** `fn_cleanup_temp_designs`'in storage-silme tarafını tamamla (TODO); enhance/bg çıktısını `ephemeral` bayrağı + kısa TTL.

### 12. enhance/accept: enhanced-temp ile designFile ilişki doğrulaması yok · D6
- **Konum:** `enhance/accept/route.ts:82-97` — `enhancedTemp.user_id===user.id` var (iyi) ama `enhancedTempDesignId`'nin gerçekten `designFileId`'den türediği doğrulanmıyor → kullanıcı alakasız bir enhanced temp'i herhangi designFile'a supersede ettirip proof akışını bozabilir.
- **Düzeltme:** enhance çıktısına `source_design_file_id` kaydet; accept'te eşleşmeyi doğrula.

## 🟡 ORTA
- **7.** upload-init ve upload-init-r2 order-status whitelist'i farklı kaynaktan (`:51` merkezi vs `:39-47` inline) — drift riski. → r2 de `CUSTOMER_UPLOADABLE_ORDER_STATUSES` import etsin. · D2
- **8.** upload-init-r2 insert hatasında orphan R2 objesi temizlenmiyor (Supabase varyantı temizliyor, `:189-197`) (`upload-init-r2:139-145`). → R2 init sırasını gözden geçir + `pending/` lifecycle. · D2/D3
- **10.** upload-complete `analyzing`'e geçirdikten sonra QC schedule hatası yutulursa dosya `analyzing`'de takılır, QC hiç tetiklenmez (`:219-277`). → `qc_scheduled=false` işareti + periyodik resume. · D3
- **11.** reprint-from-file order status kontrolü yok (`:67-75`) — iptal/iade/`rejected` sipariş/dosya reprint edilebilir. → kaynak `status in(...)` + order status kontrolü. · D2/D3
- **13.** cart/upload-preview: public bucket + tahmin edilebilir path + kota/rate-limit yok (`:100-121`) → preview enumeration (gizlilik) + depolama kötüye kullanımı. → rate-limit + signed URL/tahmin edilemez segment. · D6
- **14.** upload-init replace'te `replaceFileId` eşleşmezse sessiz devam → eski dosya superseded olmaz, hem eski hem yeni aktif kalır (üretici hangisini basacak) (`:111-129`). → eşleşme yoksa 404. · D6/D2
- **15.** design-file proxy Content-Type DB'den (client iddiası), `original_name` kısmen temizli (`editor/design-file/[tempId]/route.ts:60-66`). → Content-Type'ı ALLOWED whitelist'ten zorla. · D6

## [KOZMETİK]
- `upload-complete:46-56` `DesignFileRow` tipi `select("*")` ile eksik alanlar.
- `promote-temp-designs.ts:130` prod `console.log`.
- `design-files.ts:96-111` kullanılmayan `UploadInitResult`/`UploadCompleteParams` ölü tip.
- `temp-upload-init` yorumu "cron temizler" diyor ama storage silinmiyor (Mig 008 TODO) — yanıltıcı.

## ❓ Doğrulanacaklar
1. `design_files` üzerinde `(order_id, order_item_id, version)` gerçek UNIQUE index var mı (#3 yarışının gerçekleşebilirliği).
2. Supabase signed upload URL boyut zorluyor mu (#5).
3. R2 `pending/` prefix lifecycle expiration var mı (#1/#8).
4. `scheduleOrderDesignQC` await mi fire-and-forget mi (#10).
5. PayTR callback aynı OID için iki IPN'i seri mi paralel mi (#3 olasılığı).

**En acil:** #2 (çift complete = gerçek QC para) + #1+#9 (orphan + cron storage'ı hiç silmiyor → kalıcı storage şişmesi) · #3 (promote yarışı) · #4 (client fileId).
