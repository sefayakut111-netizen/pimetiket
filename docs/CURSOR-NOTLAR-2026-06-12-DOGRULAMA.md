# ✅ DOĞRULAMA RAPORU — Cursor'a vermeden önce bulguları teyit (12 Haziran 2026)

> Amaç: ~280 bulgu çoğunlukla grep-ağırlıklı paralel ajanlardan geldi; yanlış-pozitif riskini
> elemek için **en kritik bulgular kaynak kod BİZZAT okunarak** teyit edildi. Bu, Cursor'a
> görev vermeden önceki kalite kapısıdır. (Çözüm doğruluğu kontrolü = SONRAKİ aşama.)

## A. BİZZAT OKUNARAK DOĞRULANAN KRİTİK BULGULAR — 7/7 TRUE POSITIVE

| # | Bulgu | Kanıt (okunan satırlar) | Sonuç |
|---|---|---|---|
| 1 | **Denetçi execute çift-çalışma** | `proposal.ts:120` (`status==="approved"` kontrol) → `:141` handler ÇALIŞIR (yan-etki) → `:178-190` update yalnız `.eq("id")`, CAS yok | ✅ GERÇEK — claim yok, iki execute çift mutasyon |
| 2 | **proof-respond atlama + CAS yok** | `proof-respond:76` (`proof_pending` kontrol) → `:84` `newStatus="in_production"` → `:87-90` update `.eq("id")` CAS yok | ✅ GERÇEK — hem atlama hem TOCTOU |
| 3 | **`withCronRun` kilit değil** | `cron-logger.ts:11-19` yalnız "running" satırı insert, mevcut-running kontrolü/advisory lock YOK | ✅ GERÇEK |
| 4 | **fason token RPC re-grant** | Mig `023:14-17` revoke → Mig `089:138` + `132:78` `grant ... to authenticated` (geri açma); 089 yorumu "Mig 020 yapısı korunur" | ✅ GERÇEK (migration seviyesi) — canlı ACL ayrıca teyit |
| 5 | **KVKK DB PII silinmiyor** | `storage-purge.ts`: `orders` yalnız `select("id")` (`:210`), design/cutline yalnız **storage** silme, yorum "sipariş kaydı kalır" (`:535`), tek DB yazımı `profiles.archive_status="deleted"` (`:563-568`); `addresses`/`payments`/`orders.address`/`auth email` **hiç dokunulmuyor** | ✅ GERÇEK — en yüksek yasal risk doğrulandı |
| 6 | **Orphan charge** | `init:~397` token üretimi → `:425` intent insert → `:447` coupon reserve → `:456,469` reserve fail'de `payment_intents.delete()`; token intent silinmeden önce canlı | ✅ GERÇEK |
| 7 | **reprint-kupon idempotent değil** | `reprint-coupon:~73` dedup `.eq("description").maybeSingle()` (SELECT) + yoksa INSERT; `coupons.description`'da unique index YOK (grep boş) | ✅ GERÇEK — çift kupon mümkün |

**Sonuç:** Kritik kademede 7/7 doğru çıktı → ajan bulgularının kritik kademesi **güvenilir**. TOCTOU/yapısal bulgular (orders.status yazarları, withCronRun, grant zincirleri) doğaları gereği grep+okuma ile kesinleşir; bu kademede yanlış-pozitif beklenmiyor.

## B. KAYNAKTAN DOĞRULANAMAYAN — CANLI DB/ENV GEREKTİREN (Cursor öncesi #1 engel)

Bu maddeler kod okumayla KESİNLEŞMEZ; **çözüm yapmadan önce canlı teyit şart**:

| Madde | Neden kod yetmez | Nasıl teyit |
|---|---|---|
| 090-176 migration apply durumu | `MIGRATIONS-APPLIED.md` 089'da kalmış | DB'de `select max(version)` / migration tablosu |
| fason token / referral RPC **canlı ACL** (#4, M10-K1/K2) | grant migration'da var ama sonradan elle revoke edilmiş olabilir | `\df+ fn_validate_fason_token` ACL |
| `design_files(order_id,order_item_id,version)` + `shipment_status_events(...)` unique index | kodda iddia, migration'da net görülmedi | `\d design_files` / `pg_indexes` |
| Mig 076 (mail suppression) apply | dosya içi "BEKLİYOR" notu var ama `MIGRATIONS-APPLIED.md` "uygulandı" diyor → **çelişki** | DB'de `to_regclass('mail_suppressions')` |
| `public-assets` bucket boyut/Content-Type politikası (M17-#5) | bucket policy repo dışında | Supabase dashboard |
| Vercel plan (Hobby/Pro) — `maxDuration=300` cron'lar | env/plan repo dışında | Vercel ayarları |
| `ALLOW_AUTO_CONFIRM`, `operations` rolü atanmış kullanıcı (M9) | env/veri durumu | env + `select` profiles |

## C. ZATEN AYRIŞTIRILMIŞ SPEKÜLATİF/DÜŞÜK (yanlış-pozitif adayları)

Ajanlar bunları zaten "Doğrulanacaklar"/spekülatif diye işaretledi — kritik değil:
- jsonb `meta` clobber'ları (CAS değil, jsonb-merge RPC gerekir) — ayrı sınıf, doğru etiketli.
- `admin/returns/[id]/status` borderline TOCTOU (status guard yok ama yıkıcı değil).
- M16 circuit-breaker/timeout önerileri — iyileştirme niteliğinde, akış-bozan değil.
- Bazı "şüpheli" cron idempotency'leri (`sendAbandonedCart`/`sendReviewRequest` sarmalı idempotencyKey geçiriyor mu) — sarmal dosya okunmadı, doğrulanmalı.

## D. GENEL DEĞERLENDİRME

- **Kritik kademe (yasal/para/akış-bozan):** güvenilir — 7/7 örneklem doğru, yapısal bulgular kesin.
- **Tek gerçek belirsizlik:** "canlıda var mı/uygulandı mı" sorusu (Bölüm B) — kökü KÖK-6'daki `MIGRATIONS-APPLIED.md` boşluğu. **Çözüm aşamasından önce bu kapatılmalı**, yoksa "bu RPC/index zaten var, eklemeye gerek yok" gibi yanlış kararlar verilir.
- **Önerilen sıra:** (1) `MIGRATIONS-APPLIED.md`'yi 176'ya tamamla + Bölüm B'yi canlı teyit et → (2) çözüm/PR planı → (3) çözümlerin doğruluğunu kontrol (kullanıcının dediği sonraki aşama).
