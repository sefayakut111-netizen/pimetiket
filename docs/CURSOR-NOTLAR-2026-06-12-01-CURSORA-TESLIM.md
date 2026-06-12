# 🎯 CURSOR'A TESLİM — Uygulama Sırası ve Ön-Kontroller (12 Haziran 2026)

> **Düzenlemeleri Cursor yapacak.** Bu dosya, ~280 bulgu + 6 kök için **uygulama sırasını** ve
> her adımdan önce **canlıda teyit edilmesi gereken** noktaları verir. Detay her modülün
> `CURSOR-NOTLAR-2026-06-12-MXX-*.md` dosyasında; kökler `...-KOKLER-derin-arastirma.md`'de.
> Kritik 7 bulgu bizzat kaynaktan doğrulandı (`...-DOGRULAMA.md`).
>
> **KURAL:** Aşağıdaki her "🔎 ÖNCE TEYİT" satırını canlı DB/env'de doğrulamadan ilgili düzenlemeye
> başlama — yoksa "zaten var" sanıp eksik bırakma veya var olanı tekrar oluşturma riski.

---

## FAZ 0 — ÖN-UÇUŞ (kod yazmadan önce, canlı teyit) · KÖK-6 boşluğunu kapatır

Bu cevaplar olmadan aşağıdaki düzeltmelerin yarısı yanlış varsayıma dayanır:

| 🔎 Teyit | Komut/yöntem | Etkilediği düzeltme |
|---|---|---|
| 090-176 migration apply durumu | `select * from supabase_migrations.schema_migrations` (veya dashboard) | Tüm "RPC/index canlıda var mı" soruları |
| `fn_validate_fason_token` ACL | `\df+ public.fn_validate_fason_token` → `authenticated` var mı | M10-K1 (revoke gerekli mi) |
| `fn_complete_referral`/`fn_apply_referral_code` ACL | `\df+` | M10-K2 |
| `fn_refresh_fason_scores`/`fn_suggest_fason_partner` ACL | `\df+` | M10-Y3 |
| `design_files (order_id,order_item_id,version)` unique? | `\d design_files` / `pg_indexes` | KÖK-4 (promote yarışı) |
| `shipment_status_events (order_id,status,event_time)` unique? | `\d shipment_status_events` | KÖK-4 (kargo poll) + M7-#1 |
| `mail_suppressions` tablosu + `fn_enqueue_mail` argüman sayısı | `to_regclass('mail_suppressions')`, `\df fn_enqueue_mail` | M12-B12 (076 apply — dosya çelişkili) |
| `coupon_uses (coupon_id,user_id)` partial unique? | `\d coupon_uses` | M10-O2 |
| `pricing_config` anon SELECT politikası | `\d+` RLS policies | M10-O3 |
| `ALLOW_AUTO_CONFIRM` env değeri (prod) | env | M9-B4 |
| `operations` rolü atanmış kullanıcı var mı + `admin_role IS NULL` satır sayısı | `select` profiles | M9-B1/B3 |
| `public-assets` bucket boyut/Content-Type politikası | Supabase dashboard | M17-#5 |
| Vercel plan (Hobby/Pro) | Vercel ayarları | M13 (maxDuration=300 cron'lar) |

**Ayrıca FAZ 0'da (kod, düşük risk):** `MIGRATIONS-APPLIED.md`'yi 176'ya tamamla; docs'taki "89 migration" → 176 (6 dosya); uygulanan migration'ların dosya-içi "APPLY BEKLİYOR" notunu sil.

---

## FAZ 1 — PAYLAŞILAN ALTYAPI (önce bunlar, çünkü çok bulguyu birden kapatır)

Sıra önemli: altyapı kurulmadan tekil düzeltmeler tekrar tekrar aynı deseni yazar.

| Sıra | Altyapı | Kaynak | Kapattığı |
|---|---|---|---|
| 1.1 | **`fn_transition_order_status` RPC + TS wrapper** (CAS+matris+event+audit tek txn) | KÖKLER §KÖK-2 | orders.status 27 bypass yazarı + ~17 TOCTOU + matris-dışı geçiş + event drift |
| 1.2 | **`fn_with_advisory_lock` + `withCronRun`'a entegrasyon** | KÖKLER §KÖK-4 | 22 cron tek-instance |
| 1.3 | **`casUpdate` helper + CI grep-guard** (`\.from\(...\)\.update.*status` transition modülü dışında yasak) | KÖKLER §KÖK-1 | ~48 TOCTOU (orders dışı: archive/restore/qc/idempotency) |
| 1.4 | **2 unique index** (`design_files`, `shipment_status_events`) + `order_events` idempotency_key | KÖKLER §KÖK-4 | promote/poll/event duplike — **FAZ 0'da yoksa ekle** |

---

## FAZ 2 — KRİTİK TEKİL DÜZELTMELER (bizzat doğrulandı, yasal/para)

Sıra = etki. Her biri FAZ 1 altyapısını kullanır.

| Sıra | Bulgu | Dosya:satır | Düzeltme özü | Not ref |
|---|---|---|---|---|
| 2.1 | **KVKK DB PII silme** | `lib/kvkk/storage-purge.ts:561` | addresses sil + profiles PII null + orders.address maskele + auth email; saklama gerekeni maskele | M14-B1/B2 |
| 2.2 | **Denetçi execute claim** | `agents/_shared/proposal.ts:178` | execute öncesi `approved→executing` CAS (FAZ 1.1/1.3) | KÖKLER 1b |
| 2.3 | **Orphan charge** | `payment/init:447,456,469` | coupon reserve'i token'dan ÖNCE; token sonrası intent SİLME (`failed` işaretle) | M2-#1/#2/#5 |
| 2.4 | **iade parasız refunded + force bypass** | `admin/returns/[id]/status:15,78`; `admin/iadeler/page.tsx:153` | refunded'ı yalnız refund yolundan; UI force'u kaldır | M8-B2/B3/B4 |
| 2.5 | **reprint-kupon idempotency** | `loyalty/reprint-coupon` | `coupons(source_order_id) where kind='reprint'` partial unique + 23505 yakala | KÖKLER KÖK-4 |
| 2.6 | **fason token revoke** | Yeni migration | `revoke ... fn_validate_fason_token from authenticated` + referral RPC caller guard | M10-K1/K2 (🔎 FAZ 0) |
| 2.7 | **proof-respond atlama** | `proof-respond:84,89` | hedefi `proof_approved`; üretime geçişi fason atama RPC'sine bırak (FAZ 1.1) | M4-B3 / M5-B1 |
| 2.8 | **multi-design sözleşmesi** | `migrations` `fn_proof_summary` + `onay/[orderId]/page.tsx` | RPC `designs[]` döndürsün; `fn_finalize_proof` cutline sayım doğrulasın | M4-B1/B2 |

---

## FAZ 3 — GÜVENLİK CHOKE-POINT'LERİ (KÖK-5)

| Sıra | Guard | Düzeltme | Not ref |
|---|---|---|---|
| 3.1 | partner upload-revision | magic-byte + admin-loop zorunlu (`status:'approved'` kaldır) | M3 / KÖK-5 |
| 3.2 | AI bütçe | `assertAiBudget()` her `generateObject/Text`'ten önce (~10 yol) | M15-#1/#2 |
| 3.3 | mail suppression | admin mail route'larını `enqueueMail`'e; `sendMail` doğrudan çağrıları kısıtla | M12-B2 |
| 3.4 | partner meta redaksiyon | `redactItemMetaForPartner` whitelist (2 endpoint) | M6 / KÖK-5 |
| 3.5 | impersonation yetkisi | `operations` yerine `super_admin`; createUser'ı çıkar | M9-B1 (🔎 FAZ 0) |
| 3.6 | save-edit guard | `assertProofOrderAccess`'e geçir | M4-B11 / KÖK-5 |

---

## FAZ 4 — KALAN MODÜL DÜZELTMELERİ (öncelik dosyalarda)
Her modülün not dosyasındaki 🔴/🟠 bulgular, "En kritik" satırındaki sıraya göre. P3/P4 modülleri (kargo, mail detay, cron reminder'ları, M16 timeout, M17 CRUD) FAZ 1-3'ten sonra.

## FAZ 5 — KOZMETİK
Her dosyadaki `[KOZMETİK]` bölümleri en son; akış-bozan değil.

---

## Cursor için altın kural
Kod tabanında **doğru desen zaten var** — yeni desen icat etme, bunları kopyala:
- CAS: `admin/ai-qc/decide:99` (`.eq("status",fromStatus).select().single()` + null→409)
- Claim-pattern: `cron/auto-refund:88`, `process-mail-outbox:244`
- Atomik RPC: `fn_finalize_paid_order`, `fn_assign_order_to_fason`
- Optimistic lock: `redistribute-slot:208`
