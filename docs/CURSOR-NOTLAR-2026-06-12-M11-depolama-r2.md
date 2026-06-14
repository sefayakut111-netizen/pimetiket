# Cursor Notları — M11: Depolama & Dosya Zinciri (R2/Supabase)

> Hata-tespit (P2). Boyut: D2 sözleşme, D3 hata, D5 veri bütünlüğü, D6 güvenlik.
> **SİSTEMİK DESEN:** DB status değişimi ile fiziksel R2/Storage işlemi arasında atomiklik/doğrulama eksik — B2, B3, B6, B11, B12, B14 hepsi aynı kök: "DB yazıldı, R2 doğrulanmadı/senkronlanmadı". + R2 çağrılarında timeout/retry yok.

## 🟠 YÜKSEK

### B1. `customer/restore-url`: cold-olmayan dosyada sahiplik kontrolü ATLANIYOR (IDOR enumeration) · D6
- **Konum:** `lib/storage/restore-service.ts:63-73`
- **Sorun:** Önce `archive_status!=="cold"` erken dönüş (`:63`), sahiplik (`file.user_id!==requesterId`) SONRA (`:68`). Hata mesajı `"Dosya arşivde değil (durum: X)"` başkasının designFileId'sini deneyene dosyanın varlığını+statüsünü doğruluyor.
- **Düzeltme:** Sahiplik kontrolünü cold-kontrolünden ÖNE al; sahibi olmayana her durumda generic 404.

### B2. `cleanup-stale-uploads`: R2-direct upload'lar 24h sonra HER ZAMAN siliniyor (gerçek dosya yanlış silme) · D5
- **Konum:** `api/cron/cleanup-stale-uploads/route.ts:42-48` + `upload-init-r2/route.ts:122-133`
- **Sorun:** Cron `status='uploaded' AND sha256 IS NULL AND <24h` satırları DB+storage+R2'den siliyor. R2-direct akışı satırı `status:"uploaded"`+`sha256` NULL açıyor (sha256 yalnız complete'te set). Büyük PSD yükleyip complete'i 24h içinde çağıramayan müşterinin **gerçek yüklenmiş dosyası** "stale" sayılıp silinir. HeadObject ile R2'de obje var mı bakılmıyor.
- **Düzeltme:** Silmeden önce `getR2ObjectInfo`/Storage `list` ile fiziksel objenin YOK olduğunu doğrula; veya R2-direct için ayrı `status:"pending_upload"`.

### B3. Superseded dosyaların fiziksel nesnesi hiç silinmiyor (orphan birikimi + KVKK) · D5
- **Konum:** `orders/[id]/proof/[itemId]/background/remove/route.ts:120`, `enhance/accept/route.ts:121`
- **Sorun:** bg-remove ve enhance-accept eski satırı `superseded` yapıp yeni obje yüklüyor ama eski R2/Storage objesini silmiyor. `purge-expired-designs` RPC çıktısının superseded path'leri içerdiği kanıtsız → her işlemde kalıcı orphan; KVKK retention yalnız "aktif" path üstünden işler.
- **Düzeltme:** `superseded`'e geçerken eski `storage_path`'i hemen sil; veya purge'a superseded tarama ekle. (Doğrulama #1.)

### B4. `getSignedUploadUrl` boyut/content-type'ı imzaya bağlamıyor · D6/D2
- **Konum:** `lib/storage/r2-client.ts:213-226` (kullanım `upload-init-r2:120`)
- **Sorun:** Presigned PUT yalnız `ContentType` ile imzalı; `ContentLength`/`Content-MD5` yok. `sizeBytes` yalnız client iddiası, R2'ye iletilmiyor → müşteri 100MB sınırını aşan/farklı içerik yükleyebilir, R2 reddetmez. R2-direct yolunda magic-byte da yok.
- **Düzeltme:** `ContentLength` (signableHeaders/conditions) ekle, PUT'ta zorunlu kıl; R2-direct için upload sonrası magic-byte (Range GET ilk 64 byte).

### B5. `archive/signed-url`: admin için bucket-geneli kapsam + tahmin edilebilir key + 24h TTL · D6
- **Konum:** `api/admin/archive/signed-url/route.ts:33-58`
- **Sorun:** `archive:view`'li herhangi cowork `customers/` ile başlayan İSTEDİĞİ key için signed URL alır; prefix yalnız `startsWith("customers/")`, belirli kullanıcıya bağlı değil. Key tahmin edilebilir (`customers/{uuid}/...`) → müşteri UUID'sini bilen tüm PII snapshot'ına 24h erişir. `..`/`//` traversal değer doğrulaması yok.
- **Düzeltme:** TTL'yi 1 saate indir; key'i istek bağlamındaki `userId` ile eşleştir; `..`/`//` reddet; cowork için dar prefix + audit gerekçe.

### B6. `purge-expired-designs`: R2 silme hatasında DB soft-delete geri alınmıyor (kalıcı orphan) · D5/D3
- **Konum:** `api/cron/purge-expired-designs/route.ts:71-78, 140-142`
- **Sorun:** RPC satırları soft-delete işaretliyor (kalıcı), sonra R2 silme; `r2Errors` yalnız sayılıyor, retry/geri-alma yok. R2 down ise DB "silindi" ama obje yaşar → kalıcı orphan, bir daha taranmaz. `failedKeys` audit detail'e yazılmıyor.
- **Düzeltme:** `deleteR2Keys` `failedKeys`'i audit'e + `purge_retry` kuyruğu; başarısız satırı sonraki run'da tekrar yakala.

### B7. R2 client'ında timeout/retry yok; `external-timeouts.ts` hiç bağlanmamış · D3
- **Konum:** `lib/storage/r2-client.ts:73-96` (S3Client config), `listR2Objects:294-313` (limit yok)
- **Sorun:** `S3Client` `requestTimeout`/`maxAttempts` yok; R2 yanıt vermezse cron'lar `maxDuration`'a takılıp yarıda kesilir → kısmi silme + tutarsızlık. `listR2Objects` büyük prefix'te timeout.
- **Düzeltme:** `requestHandler: NodeHttpHandler({requestTimeout, connectionTimeout})` + `maxAttempts:3`; `R2_HTTP_TIMEOUT_MS` sabiti.

## 🟡 ORTA
- **B8.** `getSignedDownloadUrl` `ResponseContentDisposition` header injection (yalnız `"` temizli, CRLF/`;` değil; `original_name` müşteri kontrollü) (`r2-client.ts:200-204`). → RFC 5987 encode + CRLF strip (`sanitizeFilename` zaten var, `:419`). · D6
- **B9.** `cleanup-orphan-previews`: yalnız `cart_items` referans seti (abandoned cart yok → referanslı preview silinebilir); public bucket + tahmin edilebilir path (preview enumeration); `MAX_SCAN=500` (fazlası taranmaz) (`:54-78`). → tüm referans kaynakları + pagination + signed URL. · D5/D6
- **B10.** restore-url hata sınıflaması string-match (`includes("yetkisiz")`) → kırılgan; "arşivde değil" 404 olur (`restore-url/route.ts:50-54`). → tipli hata kodu. · D2
- **B11.** `archiveCustomer` kısmi başarısızlıkta bazı design_files `hot` kalırken orders/profiles koşulsuz `cold` (`archive-service.ts:226-274,343-360`) → yarım-cold müşteri. → `errors.length>0` ise cold'a çekme. · D5
- **B12.** restore signed URL R2'de obje var mı kontrol etmiyor (`restore-service.ts:72-89`) → B11/B6 sonrası müşteri ölü URL alır, audit "başarılı" der. → `getR2ObjectInfo.exists` kontrolü. · D5
- **B13.** `uploadToR2` doğrulaması yalnız boyut; gerçek checksum yok, `checksum_verified` boyut eşitliğine bağlı (yanıltıcı) (`r2-client.ts:141-153`, `archive-service.ts:232-252`). → SHA256 metadata karşılaştırması. · D2/D5
- **B14.** `restoreCustomerToHot` R2 nesneleri taşımıyor ama tüm design_files `hot` işaretliyor → hot sanılan dosya Storage'da YOK, restore-url `!=='cold'` ile reddeder → müşteri dosyasına HİÇ erişemez (`restore-service.ts:148-151`). → `hot` yapma, `cold` bırak veya V2 R2→Supabase kopyalamayı tamamla. · D5

## [KOZMETİK]
- `r2-client.ts:48-49` `IS_DRY_RUN` deprecated alias.
- `r2-client.ts:236` `@ts-expect-error` Body stream — `transformToByteArray()` tercih.
- `archive/files/route.ts:31-37` `categorizeKey` `design-files/` arıyor ama builder `orders/{id}/files/` üretiyor → kategori hep "other".

## ❓ Doğrulanacaklar
1. `fn_mark_expired_designs_for_deletion` superseded satırları kapsıyor mu (B3 kritik).
2. `design-previews` bucket gerçekten public mi (B9).
3. `customers-hot/{userId}/pending/` R2-direct upload'lar için yaşam döngüsü/temizlik var mı (B2 ek orphan).
4. Fason `contract_pdf_url` `partners/` dışı key'e işaret edebilir mi (`contract/download:55`).

**En acil:** B1 (IDOR/durum sızıntısı) · B2 (gerçek dosya yanlış silme) · B3 (superseded orphan + KVKK) · B4 (presigned PUT boyut/içerik bağlı değil) · B5 (admin signed-url geniş kapsam+24h TTL).
