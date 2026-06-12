# Cursor Notları — M14: KVKK & Veri Yaşam Döngüsü

> Hata-tespit (P3). Boyut: D1 akış, D2 sözleşme, D5 veri bütünlüğü, D6 yetki. Fason PII (M6) + depolama silme (M11) kapsam dışı.
> **KÖK SORUN (yasal risk):** KVKK silme akışı yalnız depolama dosyalarını (R2+bucket) ve `pim_conversations`'ı temizliyor; **DB'deki PII kayıtlarını (profiles, addresses, orders snapshot, payments, mail, auth.users email) ne siliyor ne anonimleştiriyor.** "Hesabımı sil" tamamlanınca `profiles.archive_status="deleted"` bayrağı atılıp PII yerinde bırakılıyor → KVKK m.7 ihlali + yanıltıcı vaat.

## 🔴 KRİTİK

### B1. `account_delete` complete'te DB-resident PII hiç silinmiyor · D2/D5
- **Konum:** `admin/kvkk-requests/[id]/process/route.ts:95-130` + `lib/kvkk/storage-purge.ts:561-569`
- **Sorun:** Complete yalnız (a) pim_chat scope'ta `pim_conversations`, (b) `purgeKvkkUserStorage` (sadece dosyalar) çağırıyor. Full delete'te tek DB işlemi `profiles.update({archive_status:"deleted"})`. `profiles.full_name/phone`, `addresses` (ad/tel/adres), `orders.address` jsonb snapshot, `payments`, `auth.users` (email) **yerinde kalıyor**. Müşteriye "adreslerin, sipariş geçmişin silinir" deniyor (verilerim/page.tsx:502-509), karşılanmıyor.
- **Düzeltme:** Complete'e yasal saklama (fatura) hariç PII anonimleştirme ekle: `addresses` sil, `profiles` PII null/anonim, `orders.address` jsonb maskele (sipariş VUK için kalsın, PII kopartılsın — m.28), `auth` email anonimleştir. Saklama gerekeni "maskele", gerekmeyeni "sil".

### B2. Silme zinciri PII tabloları açısından eksik (reviews/addresses/mail) · D2
- **Konum:** `lib/kvkk/storage-purge.ts` (tüm modül — "storage-purge", yalnız depolama)
- **Sorun:** Aydınlatma metninde beyan edilen mail kayıtları, `addresses` tablosu, `reviews` satırları silinmiyor. `partial_delete` "reviews" yalnız R2 `reviewSnapshot` dosyasını siliyor, DB `reviews` satırını değil (`:440-456`) → "silindi" denip kalan veri.
- **Düzeltme:** Her PII tablosu için silme/anonimleştirme matrisi (orders, order_items, payments, addresses, profiles, reviews, pim_conversations, mail outbox, marketing_consents); `reviews` scope'unda DB satırını da sil.

## 🟠 YÜKSEK

### B3. Admin silme yolu grace/onaylı-talep kontrolünü tamamen atlıyor · D6
- **Konum:** `customer/kvkk-archive-delete/route.ts:41-53, 61`
- **Sorun:** `!isSelf` (admin) iken `assertKvkkR2DeleteEligible` grace/onay kontrolü atlanıyor → `customers:delete`'li staff, hiç KVKK talebi olmayan/grace dolmamış/iptal edilmiş kullanıcının tüm arşivini onaysız silebilir. `kvkkRequestId` geçilmediği için audit'te hangi talebe ait izlenemiyor (kanıt zinciri kopuk).
- **Düzeltme:** Admin yolu için de geçerli `account_delete` talebi doğrulaması zorunlu; `kvkkRequestId`'yi purge'a geç.

### B4. Kısmi başarısızlıkta orphan kalıntı + idempotency garantisi yok; audit dar kapsam · D5
- **Konum:** `lib/kvkk/storage-purge.ts:559-580`
- **Sorun:** Silme atomik değil; önceki adım partial silip exception atarsa (örn. `logPurgeEvent` throw) bir kısım dosya silinmiş ama talep `completed` değil, profile `hot` kalır → orphan + tekrar denemede idempotency yok. `delete-audit` yalnız `customers/` prefix'ine bakar, `customers-hot/`/`editor-drafts/`/`print/` artıklarını görmez → orphan PII raporda "clean".
- **Düzeltme:** Adımları idempotent kur; `logPurgeEvent`'i best-effort yap; audit prefix listesini purge ile senkronla.

### B5. `process` complete grace period'u doğrulamıyor → geri-alma hakkı ihlali · D1
- **Konum:** `admin/kvkk-requests/[id]/process/route.ts:84-130`
- **Sorun:** Complete yalnız `["confirmed","processing"]` kontrol ediyor, 48sa grace dolup dolmadığına bakmıyor → admin müşteri "vazgeç" süresindeyken kalıcı silmeyi tetikleyebilir. `assertKvkkR2DeleteEligible` grace mantığı bu yolda hiç kullanılmıyor.
- **Düzeltme:** Complete dalında `grace_period_until <= now()` doğrula; dolmadıysa 409.

## 🟡 ORTA
- **B6.** İptal yalnız `confirmed/pending`'de; admin `confirmed→processing` alabilirse müşterinin grace hakkı kilitlenir (B5 ile) (`me/kvkk-requests/[id]/cancel/route.ts:43,47`). IDOR yok (sahiplik + `.eq("user_id")` doğru). → grace dolmadan `processing`'e geçişi yasakla. · D6/D1
- **B7.** Müşteri POST'unda `scope` serbest `Record<string,boolean>`, whitelist yok → `{"foo":true}` `partial_delete` validasyonu geçer, hiçbir scope eşleşmez ama talep `completed` ("silindi" denir, hiçbir şey silinmez). `pim_chat` ayrı yoldan işlenir, `resolvePurgeScope` tanımıyor — tutarsız (`me/kvkk-requests/route.ts:144-154`, `storage-purge.ts:64-77`). → scope whitelist + `pim_chat`'i tek otoriteye dahil et. · D1/D5
- **B8.** Cancel'da CSRF (`isSameOriginRequest`) yok (POST route'ta var) (`cancel/route.ts:22-33`). → ekle. · D6
- **B9.** Audit `action:"profile.delete"` create/cancel/reject için aynı — eylem ayrımı kayboluyor; cancel'da detail yok (`route.ts:194-215`, `cancel:70-78`). → ayrı action sabitleri. · D6
- **B10.** Grace içindeki (hâlâ `hot`) kullanıcı 90g hareketsizse aynı gece cold'a taşınabilir → arşivleme↔grace yarışı (`archive-inactive/route.ts:60-81`, Mig 051:162). → `get_archive_candidates`'e "açık account_delete talebi olanları hariç tut". · D1/D5

## 🟢 DÜŞÜK
- **B11.** Admin liste email için `listUsers()` tüm kullanıcıları çekip JS filtre → sayfa 1 dışı email null + PII fan-out (`admin/kvkk-requests/route.ts:85-91`). → `getUserById`/`profiles` join. · D6/perf
- **B12.** `delete-audit` denetim prefix'leri purge'den dar (B4); tek R2 hatası tüm raporu `r2Configured:false` yapıp `pending_cleanup`'ı maskeler (`delete-audit.ts:38-52,96-126`). → prefix senkron + per-request hata izolasyonu. · D5

## [KOZMETİK]
- `verilerim/page.tsx:261` grace-dolmuş confirmed'de hâlâ "Vazgeç" görünür (backend 409 verir, kullanıcı kafa karışır).
- `kvkk/page.tsx:336-340` "süre dolunca otomatik silinir" vaadi var ama 10-yıl fatura silme cron'u repoda bulunamadı (Doğrulanacaklar #1).
- `process/route.ts:44-45` çift boş satır; `cancel/route.ts:23` kullanılmayan `_req`.

## ❓ Doğrulanacaklar
1. **Fatura otomatik silme (VUK 10yıl):** UI vaadediyor ama cron repoda yok — var mı, yoksa boş vaat mi?
2. `archive_events` immutable mi, müşteri okuyamıyor mu (Mig 051).
3. `auth.users` silme stratejisi — account_delete sonrası email orphan PII; ürün kararı mı eksik mi (B1).
4. `data_export` ZIP üretip mail atan worker var mı, yoksa talep sonsuza "İşleniyor"da mı (m.11/g).
5. Müşteri mail logu (Resend) nerede, silme zincirinde mi.

**En kritik:** B1/B2 (DB PII silme/anonimleştirme zinciri eksik — en büyük yasal risk + yanıltıcı vaat) · B3 (admin silme onay/grace bypass) · B5 (grace doğrulaması yok — geri alma hakkı).
